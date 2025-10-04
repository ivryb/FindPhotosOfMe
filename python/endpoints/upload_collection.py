"""Upload collection endpoint - processes zip archives of photos."""

import json
import zipfile
import io
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List

from services.r2_storage import R2StorageService
from services.face_recognition_service import FaceRecognitionService
from services.convex_client import ConvexService
from models.types import UploadResponse, ErrorResponse


router = APIRouter()


def get_time() -> str:
    """Get current time as formatted string."""
    return datetime.now().strftime("%H:%M:%S")


def get_content_type(filename: str) -> str:
    """Determine content type based on file extension."""
    lower_filename = filename.lower()
    if lower_filename.endswith(('.jpg', '.jpeg')):
        return 'image/jpeg'
    elif lower_filename.endswith('.png'):
        return 'image/png'
    else:
        return 'application/octet-stream'


@router.post("/upload-collection", response_model=UploadResponse)
async def upload_collection(
    collection_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload and process a zip archive of photos for a collection.
    
    Args:
        collection_id: ID of the collection
        file: Zip archive containing photos
        
    Returns:
        UploadResponse with processing results
    """
    print(f"[{get_time()}] Starting upload for collection: {collection_id}")
    
    # Validate zip file
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="File must be a zip archive")
    
    try:
        # Initialize services
        r2_service = R2StorageService()
        face_service = FaceRecognitionService()
        convex_service = ConvexService()
        
        # Validate collection exists
        collection = convex_service.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found")
        
        print(f"[{get_time()}] Collection validated: {collection_id}")
        
        # Update status to processing
        convex_service.update_collection_status(collection_id, "processing", 0)
        
        # Read zip file
        zip_data = await file.read()
        zip_file = zipfile.ZipFile(io.BytesIO(zip_data))
        
        # Get list of image files
        image_extensions = ('.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG')
        image_files = [
            name for name in zip_file.namelist()
            if name.lower().endswith(image_extensions) and not name.startswith('__MACOSX')
        ]
        
        total_images = len(image_files)
        print(f"[{get_time()}] Found {total_images} images in zip archive")
        
        if total_images == 0:
            raise HTTPException(status_code=400, detail="No images found in zip archive")
        
        # Process each image
        embeddings_data = {}
        processed_count = 0
        preview_image_keys: list[str] = []
        
        for image_name in image_files:
            try:
                # Extract image data
                image_data = zip_file.read(image_name)
                
                # Extract face embeddings
                embeddings = face_service.extract_embeddings(image_data)
                
                if embeddings:
                    # Store embeddings for this image
                    embeddings_data[image_name] = embeddings
                    
                    # Upload image to R2
                    r2_key = f"{collection_id}/{image_name}"
                    content_type = get_content_type(image_name)
                    r2_service.upload_file(image_data, r2_key, content_type)
                    
                    processed_count += 1
                    # Collect first 50 keys for previews
                    if len(preview_image_keys) < 50:
                        preview_image_keys.append(r2_key)
                    
                    # Update Convex with progress every 10 images
                    if processed_count % 10 == 0:
                        convex_service.update_collection_status(
                            collection_id,
                            "processing",
                            processed_count
                        )
                        print(f"[{get_time()}] Processed {processed_count}/{total_images} images")
                
            except Exception as e:
                print(f"[{get_time()}] Error processing {image_name}: {e}")
                continue
        
        # Save embeddings to R2
        embeddings_json = json.dumps(embeddings_data, indent=2)
        embeddings_key = f"{collection_id}/embeddings.json"
        r2_service.upload_file(
            embeddings_json.encode('utf-8'),
            embeddings_key,
            'application/json'
        )
        
        print(f"[{get_time()}] Saved embeddings.json to R2")
        
        # Save first 50 preview images to Convex
        try:
            convex_service.set_collection_preview_images(collection_id, preview_image_keys)
        except Exception as e:
            print(f"[{get_time()}] Warning: failed setting preview images: {e}")

        # Update collection status to complete
        convex_service.update_collection_status(
            collection_id,
            "complete",
            processed_count
        )
        
        print(f"[{get_time()}] Upload complete. Processed {processed_count}/{total_images} images")
        
        return UploadResponse(
            success=True,
            message=f"Successfully processed {processed_count} images",
            images_processed=processed_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[{get_time()}] Error in upload_collection: {e}")
        
        # Update collection status to error
        try:
            convex_service.update_collection_status(collection_id, "error")
        except:
            pass
        
        raise HTTPException(status_code=500, detail=str(e))


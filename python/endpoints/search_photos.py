"""Search photos endpoint - finds matching faces in a collection."""

import json
import threading
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from services.r2_storage import R2StorageService
from services.face_recognition_service import FaceRecognitionService
from services.convex_client import ConvexService
from schemas.types import SearchResponse, ErrorResponse


router = APIRouter()


def get_time() -> str:
    """Get current time as formatted string."""
    return datetime.now().strftime("%H:%M:%S")


@router.post("/search-photos", response_model=SearchResponse)
async def search_photos(
    search_request_id: str = Form(...),
    reference_photo: UploadFile = File(...)
):
    """Search for matching faces in a collection.
    
    Args:
        search_request_id: ID of the search request (created in Convex)
        reference_photo: Reference photo to match against
        
    Returns:
        SearchResponse with search results
    """
    print(f"[{get_time()}] Starting search for request: {search_request_id}")
    
    # Validate image file
    if not reference_photo.content_type or not reference_photo.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Initialize services
        r2_service = R2StorageService()
        face_service = FaceRecognitionService()
        convex_service = ConvexService()
        
        # Get search request from Convex
        search_request = convex_service.get_search_request(search_request_id)
        if not search_request:
            raise HTTPException(
                status_code=404,
                detail=f"Search request {search_request_id} not found"
            )
        
        collection_id = search_request.get('collectionId')
        if not collection_id:
            raise HTTPException(status_code=400, detail="Search request missing collectionId")
        
        print(f"[{get_time()}] Search request validated. Collection: {collection_id}")
        
        # Update search request status to processing (non-blocking)
        threading.Thread(
            target=convex_service.update_search_request,
            args=(search_request_id, "processing"),
            daemon=True
        ).start()
        
        # Validate collection exists and is complete
        collection = convex_service.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found")
        
        if collection.get('status') != 'complete':
            raise HTTPException(
                status_code=400,
                detail=f"Collection {collection_id} is not ready for searching"
            )
        
        # Get total images from collection
        total_images = collection.get('imagesCount', 0)
        print(f"[{get_time()}] Collection has {total_images} images")
        
        # Extract face embeddings from reference photo
        reference_data = await reference_photo.read()
        reference_embeddings = face_service.extract_embeddings(reference_data)
        
        if not reference_embeddings:
            raise HTTPException(
                status_code=400,
                detail="No face detected in reference photo"
            )
        
        # Use the first detected face
        ref_embedding = reference_embeddings[0]['embedding']
        ref_gender = reference_embeddings[0]['gender']
        
        print(f"[{get_time()}] Reference face extracted. Gender: {'male' if ref_gender == 1 else 'female'}")
        
        # Download embeddings.json from R2
        embeddings_key = f"{collection_id}/embeddings.json"
        embeddings_data_bytes = r2_service.download_file(embeddings_key)
        
        if not embeddings_data_bytes:
            raise HTTPException(
                status_code=404,
                detail=f"Embeddings not found for collection {collection_id}"
            )
        
        embeddings_data = json.loads(embeddings_data_bytes.decode('utf-8'))
        
        print(f"[{get_time()}] Loaded embeddings for {len(embeddings_data)} images")
        
        # Update search request with total (non-blocking)
        threading.Thread(
            target=convex_service.update_search_request,
            args=(search_request_id, "processing"),
            kwargs={"total_images": total_images, "processed_images": 0},
            daemon=True
        ).start()
        
        # Find matching faces with progress updates
        matches = []
        processed_count = 0
        
        for filename, faces in embeddings_data.items():
            for face in faces:
                # Check gender match
                if face.get('gender') != ref_gender:
                    continue
                
                # Compare embeddings
                is_match, similarity = face_service.compare_embeddings(
                    ref_embedding,
                    face['embedding'],
                    threshold=0.6
                )
                
                if is_match:
                    matches.append((filename, similarity))
                    break  # Only need one match per photo
            
            processed_count += 1

            # Throttle progress updates to reduce load on Convex
            if (processed_count % 10 == 0) or (processed_count == len(embeddings_data)):
                threading.Thread(
                    target=convex_service.update_search_request,
                    args=(search_request_id, "processing"),
                    kwargs={"processed_images": processed_count},
                    daemon=True
                ).start()

            if processed_count % 100 == 0:
                print(f"[{get_time()}] Processed {processed_count}/{total_images} images, found {len(matches)} matches so far")
        
        # Sort by similarity score (highest first)
        matches.sort(key=lambda x: x[1], reverse=True)
        
        print(f"[{get_time()}] Found {len(matches)} matching images")
        
        # Build image paths for R2
        images_found = []
        for filename, similarity in matches:
            image_path = f"{collection_id}/{filename}"
            images_found.append(image_path)
        
        # Update search request with results
        convex_service.update_search_request(
            search_request_id,
            "complete",
            images_found=images_found,
            total_images=total_images,
            processed_images=total_images
        )

        # Telegram delivery is handled by the Telegram bot handler (grammY).
        
        print(f"[{get_time()}] Search complete. Found {len(matches)} matches")
        
        return SearchResponse(
            success=True,
            message=f"Found {len(matches)} matching photos",
            search_request_id=search_request_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[{get_time()}] Error in search_photos: {e}")
        
        # Update search request status to error
        try:
            convex_service.update_search_request(search_request_id, "error")
        except:
            pass
        
        raise HTTPException(status_code=500, detail=str(e))


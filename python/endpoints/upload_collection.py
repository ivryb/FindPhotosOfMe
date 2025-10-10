"""Upload collection endpoint - processes zip archives of photos."""

import json
import zipfile
import io
import re
import threading
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from typing import Callable, Optional, Dict, Any, List, Tuple, Set

from services.r2_storage import R2StorageService
from services.face_recognition_service import FaceRecognitionService
from services.convex_client import ConvexService
from schemas.types import UploadResponse, ErrorResponse


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


# -------- Shared helpers (deduplicated logic) --------
def normalize_filename(filename: str, used_names: Set[str]) -> str:
    """Flatten subfolders and sanitize names to ASCII-safe tokens.

    - Keep only letters, numbers, dot, underscore, dash
    - Remove any subfolder path; only the basename remains
    - Ensure uniqueness within a zip by suffixing -1, -2, ... if needed
    """
    base_name = Path(filename).name
    sanitized = re.sub(r"[^A-Za-z0-9._-]", "_", base_name)
    if not sanitized:
        sanitized = "file"

    if sanitized not in used_names:
        used_names.add(sanitized)
        return sanitized

    # Ensure uniqueness when duplicate sanitized names appear
    stem = Path(sanitized).stem
    ext = Path(sanitized).suffix
    counter = 1
    while True:
        candidate = f"{stem}-{counter}{ext}"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
        counter += 1


def open_zip_and_list_images(zip_bytes: bytes) -> Tuple[zipfile.ZipFile, List[str]]:
    """Open a zip from bytes and return image file entries (excluding macOS junk)."""
    zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    image_extensions = ('.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG')
    image_files = [
        name for name in zf.namelist()
        if name.lower().endswith(image_extensions) and not name.startswith('__MACOSX')
    ]
    return zf, image_files


def load_existing_embeddings(r2_service: R2StorageService, embeddings_key: str) -> Dict[str, Any]:
    """Load existing embeddings.json if present; return {} otherwise."""
    try:
        objects = r2_service.list_objects(embeddings_key)
        if objects:
            existing_bytes = r2_service.download_file(embeddings_key)
            if existing_bytes:
                return json.loads(existing_bytes.decode('utf-8'))
    except Exception as e:
        print(f"[{get_time()}] Warning: failed to load existing embeddings.json: {e}")
    return {}


def process_images(
    *,
    collection_id: str,
    zip_file: zipfile.ZipFile,
    image_files: List[str],
    r2_service: R2StorageService,
    face_service: FaceRecognitionService,
    existing_images_count: int,
    on_progress: Callable[[int, int], None],
) -> Tuple[int, Dict[str, Any], List[str]]:
    """Process images from zip and upload to R2 with flattened, sanitized names.

    Returns (processed_count, embeddings_data, preview_image_keys).
    """
    embeddings_data: Dict[str, Any] = {}
    processed_count = 0
    preview_image_keys: List[str] = []
    used_names: Set[str] = set()
    total_images = len(image_files)

    for member in image_files:
        try:
            # Extract image data
            image_data = zip_file.read(member)

            # Extract face embeddings
            embeddings = face_service.extract_embeddings(image_data)
            if not embeddings:
                continue

            # Normalize filename (flatten + sanitize + de-duplicate)
            normalized_name = normalize_filename(member, used_names)
            r2_key = f"{collection_id}/{normalized_name}"
            content_type = get_content_type(normalized_name)

            # Upload image to R2
            r2_service.upload_file(image_data, r2_key, content_type)

            # Save embeddings keyed by normalized filename
            embeddings_data[normalized_name] = embeddings

            processed_count += 1
            if len(preview_image_keys) < 50:
                preview_image_keys.append(r2_key)

            # Report progress
            on_progress(processed_count, total_images)

            if processed_count % 10 == 0:
                print(f"[{get_time()}] Processed {processed_count}/{total_images} images")
        except Exception as e:
            print(f"[{get_time()}] Error processing {member}: {e}")
            continue

    return processed_count, embeddings_data, preview_image_keys


@router.post("/upload-collection", response_model=UploadResponse)
async def upload_collection(
    request: Request,
    collection_id: Optional[str] = Form(None),
    zip_key: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Upload and process a zip archive of photos for a collection.
    
    Supports two input modes:
    - Direct R2 reference via `zip_key` (preferred; avoids Cloud Run 32MB limit)
    - Direct file upload via multipart `file` (legacy)
    
    Args:
        collection_id: ID of the collection
        zip_key: R2 object key for the uploaded zip archive
        file: Zip archive containing photos (multipart)
        
    Returns:
        UploadResponse with processing results
    """
    # Support JSON payloads as well as multipart form-data
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            data = await request.json()
            if isinstance(data, dict):
                collection_id = data.get("collection_id", collection_id)
                zip_key = data.get("zip_key", zip_key)
            print(f"[{get_time()}] Parsed JSON body for upload: collection_id={collection_id}, zip_key={zip_key}")
        except Exception as e:
            print(f"[{get_time()}] Warning: failed to parse JSON body: {e}")

    if not collection_id:
        raise HTTPException(status_code=400, detail="'collection_id' is required")

    print(f"[{get_time()}] Starting upload for collection: {collection_id}")
    if zip_key:
        print(f"[{get_time()}] zip_key provided: {zip_key}")
    elif file is not None:
        print(f"[{get_time()}] Multipart file provided: {getattr(file, 'filename', 'unknown')}")
    else:
        raise HTTPException(status_code=400, detail="Provide either 'zip_key' or 'file'")
    
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

        # Determine existing counters/state
        existing_images_count = int(collection.get("imagesCount", 0) or 0)
        existing_preview_images = collection.get("previewImages", []) or []

        # Update status to processing (preserve existing count)
        convex_service.update_collection_status(collection_id, "processing", existing_images_count)

        # Load zip bytes either from R2 by key or from uploaded file
        zip_bytes: Optional[bytes] = None
        should_delete_r2_zip: bool = False

        if zip_key:
            print(f"[{get_time()}] Downloading zip from R2: {zip_key}")
            zip_bytes = r2_service.download_file(zip_key)
            if zip_bytes is None:
                raise HTTPException(status_code=404, detail=f"Zip not found in R2: {zip_key}")
            should_delete_r2_zip = True
            print(f"[{get_time()}] Downloaded {len(zip_bytes)} bytes from R2 for {zip_key}")
        elif file is not None:
            if not file.filename or not file.filename.endswith('.zip'):
                raise HTTPException(status_code=400, detail="File must be a zip archive")
            print(f"[{get_time()}] Reading uploaded zip file into memory...")
            zip_bytes = await file.read()
            print(f"[{get_time()}] Received {(len(zip_bytes) // (1024 * 1024))}MB total from multipart upload")
        else:
            raise HTTPException(status_code=400, detail="Provide either 'zip_key' or 'file'")

        # Open zip and list images
        zip_file, image_files = open_zip_and_list_images(zip_bytes)
        total_images = len(image_files)
        print(f"[{get_time()}] Found {total_images} images in zip archive")

        if total_images == 0:
            raise HTTPException(status_code=400, detail="No images found in zip archive")

        # Prepare embeddings merge
        embeddings_key = f"{collection_id}/embeddings.json"
        existing_embeddings = load_existing_embeddings(r2_service, embeddings_key)
        if existing_embeddings:
            print(f"[{get_time()}] Existing embeddings.json found. Photos indexed: {len(existing_embeddings)}")
        else:
            print(f"[{get_time()}] No existing embeddings.json found. Starting fresh.")

        # Progress updater for collection count
        def on_progress(processed: int, _total: int) -> None:
            threading.Thread(
                target=convex_service.update_collection_status,
                args=(collection_id, "processing", existing_images_count + processed),
                daemon=True,
            ).start()

        # Process images (normalized filenames)
        processed_count, embeddings_data, preview_image_keys = process_images(
            collection_id=collection_id,
            zip_file=zip_file,
            image_files=image_files,
            r2_service=r2_service,
            face_service=face_service,
            existing_images_count=existing_images_count,
            on_progress=on_progress,
        )

        # Merge and save embeddings to R2
        merged_embeddings = {**existing_embeddings, **embeddings_data}
        embeddings_json = json.dumps(merged_embeddings, indent=2)
        r2_service.upload_file(
            embeddings_json.encode('utf-8'),
            embeddings_key,
            'application/json'
        )

        print(f"[{get_time()}] Saved embeddings.json to R2")

        # Save first 50 preview images to Convex
        try:
            combined = []
            seen = set()
            for key in list(existing_preview_images) + preview_image_keys:
                if key not in seen:
                    seen.add(key)
                    combined.append(key)
            convex_service.set_collection_preview_images(collection_id, combined[:50])
        except Exception as e:
            print(f"[{get_time()}] Warning: failed setting preview images: {e}")

        # Update collection status to complete
        convex_service.update_collection_status(
            collection_id,
            "complete",
            len(merged_embeddings)
        )

        print(f"[{get_time()}] Upload complete. Processed {processed_count}/{total_images} images")

        # Remove uploaded zip from R2 if applicable
        if zip_key and should_delete_r2_zip:
            try:
                deleted = r2_service.delete_file(zip_key)
                print(f"[{get_time()}] Deleted source zip from R2 ({zip_key}): {deleted}")
            except Exception as e:
                print(f"[{get_time()}] Warning: failed to delete source zip {zip_key}: {e}")

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
        
        # Attempt to delete R2 zip on failure as well
        try:
            if zip_key:
                r2_service.delete_file(zip_key)
                print(f"[{get_time()}] Deleted source zip after error: {zip_key}")
        except Exception:
            pass
        
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-ingest-job")
async def process_ingest_job(request: Request):
    """Process an ingest job referenced by R2 key and collection id.

    Expected JSON body: { job_id, collection_id, file_key }
    - Update Convex ingestJobs with running/total/progress
    - Process zip contents and update collection status/imagesCount
    - On completion, mark job completed; on error, mark failed
    """
    data = await request.json()
    job_id = data.get("job_id")
    collection_id = data.get("collection_id")
    file_key = data.get("file_key")

    now = get_time()
    print(f"[{now}] Ingest job received: job_id={job_id}, collection_id={collection_id}, key={file_key}")

    if not job_id or not collection_id or not file_key:
        raise HTTPException(status_code=400, detail="job_id, collection_id, and file_key are required")

    r2_service = R2StorageService()
    face_service = FaceRecognitionService()
    convex_service = ConvexService()

    try:
        # Validate collection
        collection = convex_service.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found")

        # Mark job as running
        convex_service.update_ingest_progress(job_id, status="running")

        # Download zip
        print(f"[{get_time()}] Downloading zip for ingest: {file_key}")
        zip_bytes = r2_service.download_file(file_key)
        if zip_bytes is None:
            raise HTTPException(status_code=404, detail=f"Zip not found in R2: {file_key}")

        # Inspect zip - get total images early
        zip_file, image_files = open_zip_and_list_images(zip_bytes)
        total_images = len(image_files)
        print(f"[{get_time()}] Ingest zip contains {total_images} images")
        convex_service.update_ingest_progress(job_id, total_images=total_images)

        # Load existing state
        existing_images_count = int(collection.get("imagesCount", 0) or 0)
        existing_preview_images = collection.get("previewImages", []) or []
        convex_service.update_collection_status(collection_id, "processing", existing_images_count)

        # Prepare embeddings merge
        embeddings_key = f"{collection_id}/embeddings.json"
        existing_embeddings: dict[str, Any] = {}
        try:
            objects = r2_service.list_objects(embeddings_key)
            if objects:
                existing_bytes = r2_service.download_file(embeddings_key)
                if existing_bytes:
                    existing_embeddings = json.loads(existing_bytes.decode('utf-8'))
                    print(f"[{get_time()}] Existing embeddings.json found. Photos indexed: {len(existing_embeddings)}")
            else:
                print(f"[{get_time()}] No existing embeddings.json found. Starting fresh.")
        except Exception as e:
            print(f"[{get_time()}] Warning: failed to load existing embeddings.json: {e}")

        # Process images (normalized filenames)
        def on_progress(processed: int, _total: int) -> None:
            convex_service.update_ingest_progress(job_id, processed_images=processed)
            threading.Thread(
                target=convex_service.update_collection_status,
                args=(collection_id, "processing", existing_images_count + processed),
                daemon=True,
            ).start()

        processed_count, embeddings_data, preview_image_keys = process_images(
            collection_id=collection_id,
            zip_file=zip_file,
            image_files=image_files,
            r2_service=r2_service,
            face_service=face_service,
            existing_images_count=existing_images_count,
            on_progress=on_progress,
        )

        # Merge and save embeddings
        merged_embeddings = {**existing_embeddings, **embeddings_data}
        embeddings_json = json.dumps(merged_embeddings, indent=2)
        r2_service.upload_file(
            embeddings_json.encode('utf-8'),
            embeddings_key,
            'application/json'
        )
        print(f"[{get_time()}] Ingest saved embeddings.json to R2")

        # Save preview images
        try:
            combined: list[str] = []
            seen: set[str] = set()
            for key in list(existing_preview_images) + preview_image_keys:
                if key not in seen:
                    seen.add(key)
                    combined.append(key)
            convex_service.set_collection_preview_images(collection_id, combined[:50])
        except Exception as e:
            print(f"[{get_time()}] Warning: failed setting preview images: {e}")

        # Finalize counts, statuses
        convex_service.update_collection_status(
            collection_id,
            "complete",
            len(merged_embeddings)
        )
        convex_service.mark_ingest_completed(job_id, processed_count)

        # Optionally delete zip
        try:
            deleted = r2_service.delete_file(file_key)
            print(f"[{get_time()}] Deleted source zip from R2 ({file_key}): {deleted}")
        except Exception as e:
            print(f"[{get_time()}] Warning: failed to delete source zip {file_key}: {e}")

        return {"ok": True, "processedImages": processed_count, "totalImages": total_images}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[{get_time()}] Error in process_ingest_job: {e}")
        convex_service.mark_ingest_failed(job_id, str(e))
        try:
            convex_service.update_collection_status(collection_id, "error")
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


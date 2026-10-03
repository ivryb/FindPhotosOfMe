"""Selfie submission and face matching, with results stored in Convex."""

import json
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from schemas.types import SearchResponse
from security import require_service_token
from services.convex_client import ConvexService
from services.r2_storage import R2StorageService

router = APIRouter(dependencies=[Depends(require_service_token)])
MAX_PHOTO_BYTES = 10 * 1024**2
PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}


def process_search(search_request_id: str, reference_data: bytes) -> dict:
    convex = ConvexService()
    search = convex.get_search_request(search_request_id)
    if not search:
        raise ValueError("Search request not found")
    if search["status"] == "complete":
        return {"ok": True, "matches": len(search["imagesFound"])}
    try:
        collection_id = search["collectionId"]
        collection = convex.get_collection(collection_id)
        if not collection or collection["status"] != "complete":
            raise ValueError("Event is not ready")
        if collection.get("paymentStatus") == "refunded" or collection.get("expiresAt", float("inf")) <= time.time() * 1000:
            raise ValueError("Event is no longer active")
        convex.update_search_request(search_request_id, "processing")
        from services.face_recognition_service import get_face_service
        face_service = get_face_service()
        faces = face_service.extract_embeddings(reference_data)
        if not faces:
            raise ValueError("No face detected in reference photo")
        data = R2StorageService().download_file(f"{collection_id}/embeddings.json")
        if data is None:
            raise ValueError("Face index not found")
        embeddings = json.loads(data)
        matches = face_service.find_matching_faces(faces[0]["embedding"], faces[0]["gender"], embeddings)
        convex.update_search_request(
            search_request_id, "complete",
            images_found=[f"{collection_id}/{filename}" for filename, _ in matches],
            total_images=len(embeddings), processed_images=len(embeddings),
        )
        return {"ok": True, "matches": len(matches)}
    except Exception:
        convex.update_search_request(search_request_id, "error")
        raise


@router.post("/search-photos", response_model=SearchResponse)
async def search_photos(request: Request, search_request_id: str = Form(...),
                        reference_photo: UploadFile = File(...)):
    if reference_photo.content_type not in PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="A JPEG, PNG, or WebP photo is required")
    data = await reference_photo.read(MAX_PHOTO_BYTES + 1)
    if not data or len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo must be nonempty and 10 MB or smaller")
    submit = request.app.state.execute_search
    if submit is None:
        await run_in_threadpool(process_search, search_request_id, data)
    else:
        await submit(search_request_id, data)
    return SearchResponse(success=True, message="Search complete", search_request_id=search_request_id)

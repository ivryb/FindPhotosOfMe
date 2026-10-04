"""Authenticated ingestion submission and the archive-processing job."""

import json
import re
import time
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from security import require_service_token
from services.convex_client import ConvexService
from services.r2_storage import R2StorageService
from services.thumbnails import make_thumbnail, thumbnail_key

router = APIRouter(dependencies=[Depends(require_service_token)])
MAX_ZIP_BYTES = 2 * 1024**3
MAX_ZIP_FILES = 10_000
MAX_UNCOMPRESSED_BYTES = 20 * 1024**3
MAX_IMAGE_BYTES = 50 * 1024**2


class IngestRequest(BaseModel):
    job_id: str = Field(min_length=1)
    collection_id: str = Field(min_length=1)
    file_key: str = Field(min_length=1)


def normalize_filename(filename: str, used_names: set[str]) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name) or "image"
    candidate = base
    suffix = 1
    while candidate in used_names:
        candidate = f"{Path(base).stem}-{suffix}{Path(base).suffix}"
        suffix += 1
    used_names.add(candidate)
    return candidate


def image_entries(archive: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    entries = archive.infolist()
    if len(entries) > MAX_ZIP_FILES or sum(item.file_size for item in entries) > MAX_UNCOMPRESSED_BYTES:
        raise ValueError("Archive expands beyond the processing limit")
    images = [item for item in entries if not item.is_dir()
              and not item.filename.startswith("__MACOSX/")
              and item.filename.lower().endswith((".jpg", ".jpeg", ".png"))]
    if not images:
        raise ValueError("No images found in archive")
    if any(item.file_size > MAX_IMAGE_BYTES for item in images):
        raise ValueError("An image exceeds the 50 MB processing limit")
    return images


def process_ingest_job(job_id: str, collection_id: str, file_key: str) -> dict:
    """Use deterministic keys so interrupted Modal inputs can safely run again."""
    convex = ConvexService()
    job = convex.get_ingest_job(job_id)
    if not job or job["collectionId"] != collection_id or job["fileKey"] != file_key:
        raise ValueError("Ingest job does not match this collection and archive")
    if job["status"] in ("completed", "canceled", "failed"):
        return {"ok": True, "status": job["status"]}

    try:
        collection = convex.get_collection(collection_id)
        if not collection:
            raise ValueError("Collection not found")
        if collection.get("paymentStatus") == "refunded":
            raise ValueError("This event was refunded")
        if collection.get("expiresAt", float("inf")) <= time.time() * 1000:
            raise ValueError("This event has expired")

        r2 = R2StorageService()
        from services.face_recognition_service import get_face_service
        face_service = get_face_service()
        embeddings_key = f"{collection_id}/embeddings.json"
        existing_bytes = r2.download_file(embeddings_key)
        existing = json.loads(existing_bytes) if existing_bytes is not None else {}
        # A replay may encounter embeddings saved before its completion was recorded.
        job_prefix = f"{job_id}-"
        previous = {key: value for key, value in existing.items() if not key.startswith(job_prefix)}
        convex.update_ingest_progress(job_id, status="running")
        convex.update_collection_status(collection_id, "processing")

        with TemporaryDirectory(prefix="photo-ingest-") as directory:
            path = Path(directory) / "photos.zip"
            r2.download_to_file(file_key, path, max_bytes=MAX_ZIP_BYTES)
            with zipfile.ZipFile(path) as archive:
                images = image_entries(archive)
                # Every photo is paid for up front; photos without faces are returned when the job completes.
                convex.reserve_ingest(job_id, len(images))
                convex.update_ingest_progress(job_id, total_images=len(images))
                embeddings = {}
                names: set[str] = set()
                saved_bytes = 0
                last_progress = 0.0
                for index, member in enumerate(images, 1):
                    name = job_prefix + normalize_filename(member.filename, names)
                    image = archive.read(member)
                    faces = face_service.extract_embeddings(image)
                    if faces:
                        content_type = "image/png" if name.lower().endswith(".png") else "image/jpeg"
                        thumbnail = make_thumbnail(image)
                        if not r2.upload_file(image, f"{collection_id}/{name}", content_type) \
                                or not r2.upload_file(thumbnail, thumbnail_key(collection_id, name), "image/jpeg"):
                            raise RuntimeError("Could not save processed photo")
                        embeddings[name] = faces
                        saved_bytes += len(image) + len(thumbnail)
                    if time.monotonic() - last_progress >= 1 or index == len(images):
                        convex.update_ingest_progress(job_id, processed_images=index)
                        last_progress = time.monotonic()

        merged = {**previous, **embeddings}
        if not r2.upload_file(json.dumps(merged).encode(), embeddings_key, "application/json"):
            raise RuntimeError("Could not save face index")
        previews = [f"{collection_id}/{name}" for name in list(merged)[:50]]
        convex.set_collection_preview_images(collection_id, previews)
        convex.update_collection_status(collection_id, "complete", len(merged))
        convex.mark_ingest_completed(job_id, len(images), len(embeddings), saved_bytes)
    except Exception as exc:
        # A lost response to markCompleted must not turn a completed event into an error.
        saved_job = convex.get_ingest_job(job_id)
        if saved_job and saved_job["status"] == "completed":
            return {"ok": True, "status": "completed"}
        # Keep the source archive on failure; the existing Retry action needs it.
        convex.update_collection_status(collection_id, "error")
        convex.mark_ingest_failed(job_id, str(exc))
        raise

    # Completion is durable before deleting the only source archive.
    r2.delete_file(file_key)
    return {"ok": True, "processedImages": len(images), "matchedImages": len(embeddings)}


@router.post("/process-ingest-job", status_code=202)
async def submit_ingest_job(job: IngestRequest, request: Request):
    submit = request.app.state.submit_ingest
    if submit is None:
        await run_in_threadpool(process_ingest_job, job.job_id, job.collection_id, job.file_key)
    else:
        await submit(job.job_id, job.collection_id, job.file_key)
    return {"ok": True, "jobId": job.job_id}

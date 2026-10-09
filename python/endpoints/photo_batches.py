"""Processing of uploaded photos: one batch of up to 50 per call, and merging finished batches into a gallery's face index.

Convex hands out the work (packages/backend/convex/uploads.ts) and retries a batch whose worker goes quiet, so both
are safe to run twice: keys are fixed by Convex, and the first result for a batch is the one that counts.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from security import require_service_token
from services.convex_client import ConvexService
from services.r2_storage import R2StorageService
from services.renditions import RENDITION_TYPE, make_renditions, screen_key, thumbnail_key

router = APIRouter(dependencies=[Depends(require_service_token)])
# The face index and model are imported inside the workers: the web endpoint that loads this module has no numpy.
# Photos fetched from R2 at once while faces are found
DOWNLOADS = 8


class BatchRequest(BaseModel):
    batch_id: str = Field(min_length=1)


class MergeRequest(BaseModel):
    collection_id: str = Field(min_length=1)
    batch_ids: list[str] = Field(min_length=1)


@router.post("/process-batch", status_code=202)
async def submit_batch(body: BatchRequest, request: Request):
    submit = request.app.state.submit_batch
    await (submit(body.batch_id) if submit else run_in_threadpool(process_batch, body.batch_id))
    return {"accepted": True}


@router.post("/merge-faces", status_code=202)
async def submit_merge(body: MergeRequest, request: Request):
    submit = request.app.state.submit_merge
    args = (body.collection_id, body.batch_ids)
    await (submit(*args) if submit else run_in_threadpool(merge_faces, *args))
    return {"accepted": True}


def process_batch(batch_id: str) -> dict:
    """Keeps valid photos (face-only unless crowdsourcing, and only if moderation allows them), saves
    their thumbnails, screen versions and face indexes, and reports what was kept with its billed bytes. The rest are
    refunded; uploaded copies are deleted once Convex has the result."""
    convex = ConvexService()
    batch = convex.get_batch(batch_id)
    if not batch or batch["status"] not in ("pending", "running"):
        return {"ok": True, "skipped": True}
    collection_id = batch["collectionId"]
    photos = batch["photos"]
    log(f"Batch {batch_id}: {len(photos)} photos for {collection_id}")
    try:
        r2 = R2StorageService()
        from services.face_index import Faces, batch_key
        from services.face_recognition_service import get_face_service
        from services.moderation import ModerationService
        face_service = get_face_service()
        moderation = ModerationService()
        found: dict[str, list[dict]] = {}
        saved: list[str] = []
        saved_bytes = 0
        with ThreadPoolExecutor(DOWNLOADS) as pool:
            # A few photos at a time: downloads outpace face finding, and 50 large photos at once don't fit in memory.
            for start in range(0, len(photos), DOWNLOADS):
                chunk = photos[start:start + DOWNLOADS]
                images = list(pool.map(lambda photo: r2.download_file(photo["source"]), chunk))
                # The browser registers a batch only once all its photos are uploaded, so a missing one means
                # another worker finished this batch and cleared them. Writing now would replace its faces file.
                if any(image is None for image in images):
                    log(f"Batch {batch_id}: already finished by another worker")
                    return {"ok": True, "skipped": True}
                for photo, image in zip(chunk, images):
                    faces = face_service.extract_embeddings(image)
                    if not faces and not batch.get("keepAllPhotos", False):
                        continue
                    name = photo["key"].split("/", 1)[1]
                    try:
                        renditions = make_renditions(image)
                    except ValueError:
                        # A corrupt photo must not discard the other photos in its batch.
                        continue
                    if not moderation.allows(renditions.thumbnail):
                        log(f"Batch {batch_id}: turned away {photo['name']} after moderation")
                        continue
                    # The original goes last: a photo in the gallery always has its smaller copies, which the screen
                    # version backfill relies on to run alongside uploads.
                    if not r2.upload_file(renditions.thumbnail, thumbnail_key(collection_id, name), RENDITION_TYPE) \
                            or not r2.upload_file(renditions.screen, screen_key(collection_id, name), RENDITION_TYPE) \
                            or not r2.copy_file(photo["source"], photo["key"]):
                        raise RuntimeError(f"Could not save {photo['key']}")
                    if faces:
                        found[name] = faces
                    saved.append(photo["name"])
                    # Storage is billed for the photo and its thumbnail; the screen version only makes the viewer fast.
                    saved_bytes += len(image) + len(renditions.thumbnail)
                done = start + len(chunk)
                convex.report_progress(batch_id, batch["attempt"], done)
                log(f"Batch {batch_id}: went through {done} of {len(photos)} photos")
        if found and not r2.upload_file(Faces.of(found).encode(), batch_key(collection_id, batch_id), "application/octet-stream"):
            raise RuntimeError(f"Could not save the faces of batch {batch_id}")
        convex.complete_batch(batch_id, saved, saved_bytes)
    except Exception:
        # Retried right away instead of after the wait for a worker that went quiet.
        convex.fail_batch(batch_id, batch["attempt"])
        raise
    r2.delete_files([photo["source"] for photo in photos])
    log(f"Batch {batch_id}: kept {len(saved)} of {len(photos)} photos")
    return {"ok": True, "saved": len(saved)}


def merge_faces(collection_id: str, batch_ids: list[str]) -> dict:
    """Folds finished batches' face files into the gallery's index. Convex runs one merge per gallery at a time."""
    from services.face_index import Faces, batch_key, index_key
    r2 = R2StorageService()
    keys = [batch_key(collection_id, batch_id) for batch_id in batch_ids]
    with ThreadPoolExecutor(DOWNLOADS) as pool:
        batches = [Faces.decode(data) for data in pool.map(r2.download_file, keys) if data]
    existing = r2.download_file(index_key(collection_id))
    index = Faces.decode(existing) if existing else Faces.empty()
    merged = Faces.join([index.without({name for part in batches for name in part.names.tolist()}), *batches])
    if not r2.upload_file(merged.encode(), index_key(collection_id), "application/octet-stream"):
        raise RuntimeError(f"Could not save the face index of {collection_id}")
    ConvexService().faces_merged(collection_id, batch_ids)
    # Search reads batch files too, so they go only once Convex knows they're merged.
    r2.delete_files(keys)
    log(f"Merged {len(batches)} batch files into {collection_id}: {len(merged.names)} faces")
    return {"ok": True, "faces": len(merged.names)}


def log(message: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

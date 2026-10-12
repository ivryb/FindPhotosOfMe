"""Processing of uploaded photos: one batch of up to 50 per call, or a single video, and merging finished batches into
a gallery's face index.

Convex hands out the work (packages/backend/convex/uploads.ts) and retries a batch whose worker goes quiet, so both
are safe to run twice: keys are fixed by Convex, and the first result for a batch is the one that counts.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import NamedTuple

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from security import require_service_token
from services.convex_client import ConvexService
from services.r2_storage import R2StorageService
from services.renditions import RENDITION_TYPE, make_renditions, screen_key, thumbnail_key
from services.video import WEB_VIDEO_TYPE, is_video, make_web_video

router = APIRouter(dependencies=[Depends(require_service_token)])
# The face index and model are imported inside the workers: the web endpoint that loads this module has no numpy.
# Photos fetched from R2 at once while faces are found
DOWNLOADS = 8


class BatchRequest(BaseModel):
    batch_id: str = Field(min_length=1)
    # A batch of one video, which goes to the workers that convert videos
    video: bool = False


class MergeRequest(BaseModel):
    collection_id: str = Field(min_length=1)
    batch_ids: list[str] = Field(min_length=1)


@router.post("/process-batch", status_code=202)
async def submit_batch(body: BatchRequest, request: Request):
    submit = request.app.state.submit_video if body.video else request.app.state.submit_batch
    await (submit(body.batch_id) if submit else run_in_threadpool(process_batch, body.batch_id))
    return {"accepted": True}


@router.post("/merge-faces", status_code=202)
async def submit_merge(body: MergeRequest, request: Request):
    submit = request.app.state.submit_merge
    args = (body.collection_id, body.batch_ids)
    await (submit(*args) if submit else run_in_threadpool(merge_faces, *args))
    return {"accepted": True}


class Kept(NamedTuple):
    """What a kept photo or video adds beside its original. Moderation judges it by `screened`."""
    thumbnail: bytes
    screen: bytes
    screen_type: str
    faces: list[dict]
    billed_bytes: int
    screened: list[bytes]


def process_batch(batch_id: str) -> dict:
    """Keeps valid photos (face-only unless crowdsourcing) and videos if moderation allows them, saves their
    thumbnails, screen versions and face indexes, and reports what was kept with its billed bytes. The rest are
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
        from services.moderation import ModerationService
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
                for photo, data in zip(chunk, images):
                    name = photo["key"].split("/", 1)[1]
                    kept = keep_video(data) if is_video(name) else keep_photo(data, batch.get("keepAllPhotos", False))
                    if not kept:
                        continue
                    if not all(moderation.allows(image) for image in kept.screened):
                        log(f"Batch {batch_id}: turned away {photo['name']} after moderation")
                        continue
                    # The original goes last: a photo in the gallery always has its smaller copies, which the screen
                    # version backfill relies on to run alongside uploads.
                    if not r2.upload_file(kept.thumbnail, thumbnail_key(collection_id, name), RENDITION_TYPE) \
                            or not r2.upload_file(kept.screen, screen_key(collection_id, name), kept.screen_type) \
                            or not r2.copy_file(photo["source"], photo["key"]):
                        raise RuntimeError(f"Could not save {photo['key']}")
                    if kept.faces:
                        found[name] = kept.faces
                    saved.append(photo["name"])
                    saved_bytes += kept.billed_bytes
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


def keep_photo(image: bytes, keep_all: bool) -> Kept | None:
    """A photo with faces, or any readable photo when the gallery keeps them all."""
    from services.face_recognition_service import get_face_service
    faces = get_face_service().extract_embeddings(image)
    if not faces and not keep_all:
        return None
    try:
        renditions = make_renditions(image)
    except ValueError:
        # A corrupt photo must not discard the other photos in its batch.
        return None
    # Storage is billed for the photo and its thumbnail; the screen version only makes the viewer fast.
    return Kept(renditions.thumbnail, renditions.screen, RENDITION_TYPE, faces, len(image) + len(renditions.thumbnail),
                [renditions.thumbnail])


def keep_video(video: bytes) -> Kept | None:
    """Any video ffmpeg can read. Its first frame is its poster, and frames from across it go to moderation."""
    try:
        web = make_web_video(video)
        frames = [make_renditions(frame).thumbnail for frame in web.frames]
    except ValueError:
        return None
    if not frames:
        return None
    # The web copy is what the gallery plays, so storage is billed for it too.
    return Kept(frames[0], web.video, WEB_VIDEO_TYPE, [], len(video) + len(web.video) + len(frames[0]), frames)


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

"""One-time job for galleries made before thumbnails existed: makes missing thumbnails and records each gallery's size.

Run with `modal run python/modal_app.py::backfill_thumbnails`. Safe to run again; photos that have a thumbnail are skipped.
"""

from datetime import datetime

from services.convex_client import ConvexService
from services.r2_storage import R2StorageService
from services.thumbnails import THUMBNAIL_TYPE, make_thumbnail, thumbnail_key


def backfill_thumbnails(r2=None, convex=None) -> dict:
    r2 = r2 or R2StorageService()
    convex = convex or ConvexService()
    galleries: dict[str, dict] = {}
    # Keys are {collection}/{photo}, {collection}/thumbs/{photo}, face indexes, and uploads/... waiting to be processed
    for item in r2.list_objects(""):
        collection_id, _, rest = item["Key"].partition("/")
        if collection_id == "uploads" or not rest or rest == "embeddings.json" or rest.startswith("faces/"):
            continue
        gallery = galleries.setdefault(collection_id, {"photos": [], "thumbs": set(), "bytes": 0})
        gallery["bytes"] += item["Size"]
        if rest.startswith("thumbs/"):
            gallery["thumbs"].add(rest.removeprefix("thumbs/"))
        # Other files can sit beside photos, such as backups of old face indexes
        elif "/" not in rest and rest.lower().endswith((".jpg", ".jpeg", ".png")):
            gallery["photos"].append(rest)

    # A top-level folder without photos isn't a gallery, such as backups/
    galleries = {collection_id: gallery for collection_id, gallery in galleries.items() if gallery["photos"]}
    made = 0
    for collection_id, gallery in galleries.items():
        for name in gallery["photos"]:
            if name in gallery["thumbs"]:
                continue
            thumbnail = make_thumbnail(r2.download_file(f"{collection_id}/{name}"))
            if not r2.upload_file(thumbnail, thumbnail_key(collection_id, name), THUMBNAIL_TYPE):
                raise RuntimeError(f"Could not save the thumbnail for {collection_id}/{name}")
            gallery["bytes"] += len(thumbnail)
            made += 1
        try:
            convex.set_stored_bytes(collection_id, gallery["bytes"])
        except Exception as error:
            # Files can outlive a deleted gallery; there is nothing to record for them.
            print(f"[{datetime.now().isoformat()}] Skipped size for {collection_id}: {error}")
        print(f"[{datetime.now().isoformat()}] {collection_id}: {len(gallery['photos'])} photos, {gallery['bytes']:,} bytes")
    return {"galleries": len(galleries), "thumbnails": made}

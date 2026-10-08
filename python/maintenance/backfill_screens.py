"""One-time job for photos processed before screen versions existed: makes the missing ones. Gallery sizes stay as
they are: storage is billed for each photo and its thumbnail, and screen versions only make the viewer fast.

Run with `modal run --detach python/modal_app.py::backfill_screens`, adding `--collection-id <id>` for one gallery.
Safe to run again, and while uploads are processing: it only writes missing files under {collection}/screen/, and
processing saves a photo's screen version before the photo itself.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from functools import partial

from services.r2_storage import R2StorageService
from services.renditions import RENDITION_TYPE, make_renditions, screen_key

# Photos made at once. Decoding and encoding release the GIL, so threads keep the cores busy while others download.
WORKERS = 8


def backfill_screens(collection_id: str | None = None, r2=None) -> dict:
    r2 = r2 or R2StorageService()
    missing = missing_screens(r2.list_objects(f"{collection_id}/" if collection_id else ""))
    made = failed = 0
    with ThreadPoolExecutor(WORKERS) as pool:
        for gallery, names in missing.items():
            sizes = list(pool.map(partial(make_screen, r2, gallery), names))
            screens = [size for size in sizes if size]
            made += len(screens)
            failed += sizes.count(None)
            log(f"{gallery}: made {len(screens)} of {len(names)} missing screen versions, {sum(screens):,} bytes")
    return {"galleries": len(missing), "screens": made, "failed": failed}


def missing_screens(objects: list[dict]) -> dict[str, list[str]]:
    """Names of photos without a screen version, by gallery. Photos sit directly in their gallery's folder, beside
    thumbs/, screen/, faces/ and other files such as index backups; uploads/ holds photos waiting to be processed."""
    keys = {item["Key"] for item in objects}
    missing: dict[str, list[str]] = {}
    for key in sorted(keys):
        collection_id, _, name = key.partition("/")
        if "/" not in name and name.lower().endswith((".jpg", ".jpeg", ".png", ".bmp")) \
                and screen_key(collection_id, name) not in keys:
            missing.setdefault(collection_id, []).append(name)
    return missing


def make_screen(r2, collection_id: str, name: str) -> int | None:
    """Bytes of the photo's new screen version, or None if it failed; the next run tries it again."""
    key = f"{collection_id}/{name}"
    try:
        original = r2.download_file(key)
        # Deleted with its gallery since the listing
        if original is None:
            return 0
        screen = make_renditions(original).screen
        if r2.upload_file(screen, screen_key(collection_id, name), RENDITION_TYPE):
            return len(screen)
    except Exception as error:
        # An unreadable photo or a failed download must not stop the run over every other gallery.
        log(f"Could not make the screen version of {key}: {error}")
    return None


def log(message: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

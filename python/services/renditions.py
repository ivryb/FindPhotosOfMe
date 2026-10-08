"""Smaller WebP copies of each gallery photo, saved under the photo's own name: {collection}/thumbs/ for the gallery
grid and {collection}/screen/ for the full-screen viewer, so neither loads the camera original.

WebP is about a third smaller than JPEG at the same quality. Thumbnails made before the switch are JPEG under the
same names; R2 keeps each file's content type, so both kinds are served correctly.
"""

from typing import NamedTuple

THUMBNAIL_EDGE = 640
SCREEN_EDGE = 2048
RENDITION_QUALITY = 80
RENDITION_TYPE = "image/webp"


class Renditions(NamedTuple):
    screen: bytes
    thumbnail: bytes


def thumbnail_key(collection_id: str, name: str) -> str:
    return f"{collection_id}/thumbs/{name}"


def screen_key(collection_id: str, name: str) -> str:
    return f"{collection_id}/screen/{name}"


def make_renditions(image: bytes) -> Renditions:
    """Decodes the photo once and shrinks its long edge to each size; smaller photos keep theirs. OpenCV applies EXIF
    orientation, so phone photos come out upright."""
    import cv2
    import numpy as np

    try:
        pixels = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    except cv2.error as error:
        # Empty and malformed uploads may raise instead of returning None; both are unreadable photos.
        raise ValueError("A photo could not be read") from error
    if pixels is None:
        raise ValueError("A photo could not be read")
    encoded = []
    # Largest first, so the thumbnail is shrunk from the screen version and the full photo can be freed early
    for edge in (SCREEN_EDGE, THUMBNAIL_EDGE):
        height, width = pixels.shape[:2]
        scale = edge / max(height, width)
        if scale < 1:
            pixels = cv2.resize(pixels, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
        ok, webp = cv2.imencode(".webp", pixels, [cv2.IMWRITE_WEBP_QUALITY, RENDITION_QUALITY])
        if not ok:
            raise ValueError("A smaller copy of a photo could not be made")
        encoded.append(webp.tobytes())
    screen, thumbnail = encoded
    return Renditions(screen=screen, thumbnail=thumbnail)

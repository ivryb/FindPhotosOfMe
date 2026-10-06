"""Small WebP previews for the gallery grid, saved next to each photo under {collection}/thumbs/.

WebP is about a third smaller than JPEG at the same quality. Thumbnails made before the switch are JPEG under the
same names; R2 keeps each file's content type, so both kinds are served correctly.
"""

THUMBNAIL_EDGE = 640
THUMBNAIL_QUALITY = 80
THUMBNAIL_TYPE = "image/webp"


def thumbnail_key(collection_id: str, name: str) -> str:
    return f"{collection_id}/thumbs/{name}"


def make_thumbnail(image: bytes) -> bytes:
    """Shrinks the long edge to THUMBNAIL_EDGE. OpenCV applies EXIF orientation, so phone photos come out upright."""
    import cv2
    import numpy as np

    try:
        pixels = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    except cv2.error as error:
        # Empty and malformed uploads may raise instead of returning None; both are unreadable photos.
        raise ValueError("A photo could not be read") from error
    if pixels is None:
        raise ValueError("A photo could not be read")
    height, width = pixels.shape[:2]
    scale = THUMBNAIL_EDGE / max(height, width)
    if scale < 1:
        pixels = cv2.resize(pixels, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode(".webp", pixels, [cv2.IMWRITE_WEBP_QUALITY, THUMBNAIL_QUALITY])
    if not ok:
        raise ValueError("A thumbnail could not be made")
    return encoded.tobytes()

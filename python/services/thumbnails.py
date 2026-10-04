"""Small JPEG previews for the gallery grid, saved next to each photo under {collection}/thumbs/."""

THUMBNAIL_EDGE = 640
THUMBNAIL_QUALITY = 80


def thumbnail_key(collection_id: str, name: str) -> str:
    return f"{collection_id}/thumbs/{name}"


def make_thumbnail(image: bytes) -> bytes:
    """Shrinks the long edge to THUMBNAIL_EDGE. OpenCV applies EXIF orientation, so phone photos come out upright."""
    import cv2
    import numpy as np

    pixels = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if pixels is None:
        raise ValueError("A photo could not be read")
    height, width = pixels.shape[:2]
    scale = THUMBNAIL_EDGE / max(height, width)
    if scale < 1:
        pixels = cv2.resize(pixels, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode(".jpg", pixels, [cv2.IMWRITE_JPEG_QUALITY, THUMBNAIL_QUALITY])
    if not ok:
        raise ValueError("A thumbnail could not be made")
    return encoded.tobytes()

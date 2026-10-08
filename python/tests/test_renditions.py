import io
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.renditions import SCREEN_EDGE, THUMBNAIL_EDGE, make_renditions, screen_key, thumbnail_key

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")
Image = pytest.importorskip("PIL.Image")


def jpeg(width, height, orientation=None):
    image = Image.new("RGB", (width, height), "red")
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    data = io.BytesIO()
    image.save(data, "JPEG", exif=exif)
    return data.getvalue()


def sizes(photo):
    """The (width, height) of the screen version and the thumbnail."""
    def size(data):
        pixels = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        return pixels.shape[1], pixels.shape[0]
    renditions = make_renditions(photo)
    return size(renditions.screen), size(renditions.thumbnail)


def test_renditions_shrink_the_long_edge_and_keep_the_shape():
    assert sizes(jpeg(4000, 3000)) == ((SCREEN_EDGE, 1536), (THUMBNAIL_EDGE, 480))


def test_renditions_turn_phone_photos_upright():
    # Stored landscape, displayed portrait (EXIF orientation 6)
    assert sizes(jpeg(4000, 3000, orientation=6)) == ((1536, SCREEN_EDGE), (480, THUMBNAIL_EDGE))


def test_renditions_are_webp_as_their_content_type_says():
    renditions = make_renditions(jpeg(800, 600))
    assert renditions.screen[8:12] == renditions.thumbnail[8:12] == b"WEBP"


def test_photos_are_never_enlarged():
    assert sizes(jpeg(1200, 900)) == ((1200, 900), (THUMBNAIL_EDGE, 480))
    assert sizes(jpeg(300, 200)) == ((300, 200), (300, 200))


def test_renditions_live_beside_the_photo_under_its_own_name():
    assert thumbnail_key("event", "job-photo.jpg") == "event/thumbs/job-photo.jpg"
    assert screen_key("event", "job-photo.jpg") == "event/screen/job-photo.jpg"

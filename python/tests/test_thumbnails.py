import io
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.thumbnails import THUMBNAIL_EDGE, make_thumbnail, thumbnail_key

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


def size(data):
    pixels = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    return pixels.shape[1], pixels.shape[0]


def test_thumbnail_shrinks_the_long_edge_and_keeps_the_shape():
    assert size(make_thumbnail(jpeg(4000, 3000))) == (THUMBNAIL_EDGE, 480)


def test_thumbnail_turns_phone_photos_upright():
    # Stored landscape, displayed portrait (EXIF orientation 6)
    assert size(make_thumbnail(jpeg(4000, 3000, orientation=6))) == (480, THUMBNAIL_EDGE)


def test_small_photos_are_not_enlarged():
    assert size(make_thumbnail(jpeg(300, 200))) == (300, 200)


def test_thumbnails_live_under_the_gallery_thumbs_folder():
    assert thumbnail_key("event", "job-photo.jpg") == "event/thumbs/job-photo.jpg"

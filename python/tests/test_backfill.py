import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from maintenance import backfill_thumbnails as backfill


def test_backfill_makes_missing_thumbnails_and_records_gallery_sizes(monkeypatch):
    objects = {
        "event/a.jpg": b"aaaa", "event/b.jpg": b"bbbb", "event/thumbs/a.jpg": b"ta",
        "event/embeddings.json": b"{}", "uploads/event/day.zip": b"zip", "gone/c.jpg": b"cc",
    }
    sizes = {}

    class Storage:
        def list_objects(self, prefix): return [{"Key": key, "Size": len(data)} for key, data in objects.items()]
        def download_file(self, key): return objects[key]
        def upload_file(self, data, key, content_type):
            objects[key] = data
            return True

    class Convex:
        def set_stored_bytes(self, collection_id, stored_bytes):
            if collection_id == "gone": raise RuntimeError("Gallery not found")
            sizes[collection_id] = stored_bytes

    monkeypatch.setattr(backfill, "make_thumbnail", lambda data: b"small-" + data)
    result = backfill.backfill_thumbnails(Storage(), Convex())

    assert objects["event/thumbs/b.jpg"] == b"small-bbbb"
    assert objects["event/thumbs/a.jpg"] == b"ta"
    # Two photos, the existing thumbnail, and the new one; the face index and uploads don't count
    assert sizes == {"event": 4 + 4 + 2 + 10}
    assert result == {"galleries": 2, "thumbnails": 2}

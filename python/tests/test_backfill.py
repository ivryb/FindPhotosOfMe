import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from maintenance import backfill_thumbnails as backfill


def test_backfill_makes_missing_thumbnails_and_records_gallery_sizes(monkeypatch):
    objects = {
        "event/a.jpg": b"aaaa", "event/b.jpg": b"bbbb", "event/thumbs/a.jpg": b"ta",
        "event/embeddings.json": b"{}", "event/faces/index.npz": b"faces", "uploads/event/up/x.jpg": b"x", "gone/c.jpg": b"cc",
        "backups/event-embeddings.json.bak": b"{}",
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


def test_convert_moves_old_face_indexes_into_the_new_format_alongside_newer_faces():
    from maintenance.convert_face_indexes import convert_face_indexes
    from services.face_index import Faces, index_key
    face = [{"embedding": [1.0, 0.0], "gender": 0}]
    objects = {
        "event/embeddings.json": json.dumps({"old.jpg": face, "no-faces.jpg": []}).encode(),
        # Uploaded after the release but before this ran
        index_key("event"): Faces.of({"new.jpg": face}).encode(),
        "other/a.jpg": b"a",
    }

    class Storage:
        def list_objects(self, prefix): return [{"Key": key} for key in list(objects) if key.startswith(prefix)]
        def download_file(self, key): return objects.get(key)
        def upload_file(self, data, key, content_type):
            objects[key] = data
            return True
        def delete_files(self, keys):
            for key in keys: objects.pop(key, None)

    assert convert_face_indexes(Storage()) == {"galleries": 1}
    assert sorted(Faces.decode(objects[index_key("event")]).names.tolist()) == ["new.jpg", "old.jpg"]
    assert "event/embeddings.json" not in objects
    assert convert_face_indexes(Storage()) == {"galleries": 0}

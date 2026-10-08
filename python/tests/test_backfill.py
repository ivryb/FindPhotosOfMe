import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from maintenance import backfill_screens as screens, backfill_thumbnails as backfill
from services.renditions import Renditions


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

    monkeypatch.setattr(backfill, "make_renditions", lambda data: Renditions(screen=b"screen-" + data, thumbnail=b"small-" + data))
    result = backfill.backfill_thumbnails(Storage(), Convex())

    assert objects["event/thumbs/b.jpg"] == b"small-bbbb"
    assert objects["event/thumbs/a.jpg"] == b"ta"
    # Two photos, the existing thumbnail, and the new one; the face index and uploads don't count
    assert sizes == {"event": 4 + 4 + 2 + 10}
    assert result == {"galleries": 2, "thumbnails": 2}


def test_screen_backfill_makes_only_missing_screen_versions(monkeypatch):
    objects = {
        "event/a.jpg": b"aaaa", "event/b.jpg": b"bbbb", "event/broken.jpg": b"",
        "event/thumbs/a.jpg": b"ta", "event/thumbs/b.jpg": b"tb", "event/screen/a.jpg": b"sa",
        "event/faces/index.npz": b"faces", "uploads/event/up/x.jpg": b"x", "backups/event-embeddings.json.bak": b"{}",
        "unsized/c.png": b"cc", "gone/d.jpg": b"dd", "other/e.jpg": b"ee",
    }
    before = dict(objects)
    downloaded = []

    class Storage:
        def list_objects(self, prefix): return [{"Key": key, "Size": len(data)} for key, data in objects.items() if key.startswith(prefix)]
        def download_file(self, key):
            downloaded.append(key)
            return objects.get(key)
        def upload_file(self, data, key, content_type):
            assert content_type == "image/webp"
            objects[key] = data
            return True

    def make_renditions(data):
        if not data: raise ValueError("A photo could not be read")
        return Renditions(screen=b"screen-" + data, thumbnail=b"small-" + data)

    monkeypatch.setattr(screens, "make_renditions", make_renditions)
    # The unreadable photo is left for the next run
    assert screens.backfill_screens("event", Storage()) == {"galleries": 1, "screens": 1, "failed": 1}
    assert objects["event/screen/b.jpg"] == b"screen-bbbb"
    assert "other/screen/e.jpg" not in objects

    assert screens.backfill_screens(None, Storage()) == {"galleries": 4, "screens": 3, "failed": 1}
    assert "event/a.jpg" not in downloaded and downloaded.count("event/b.jpg") == 1
    # Only screen versions are added; photos, thumbnails, face indexes and uploads stay as they were
    assert {key: objects[key] for key in before} == before
    assert sorted(key for key in objects if key not in before) == [
        "event/screen/b.jpg", "gone/screen/d.jpg", "other/screen/e.jpg", "unsized/screen/c.png"]


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


"""One-time job: moves each gallery's old face index, {collection}/embeddings.json, into {collection}/faces/index.npz.

Run with `modal run python/modal_app.py::convert_face_indexes` right after deploying, since search reads only the new
format. Faces already in the new index (from uploads since the deploy) are kept. Safe to run again.
"""

import json
from datetime import datetime

from services.face_index import Faces, index_key
from services.r2_storage import R2StorageService


def convert_face_indexes(r2=None) -> dict:
    r2 = r2 or R2StorageService()
    old_indexes = [item["Key"] for item in r2.list_objects("") if item["Key"].endswith("/embeddings.json")]
    for key in old_indexes:
        collection_id = key.split("/", 1)[0]
        old = Faces.of(json.loads(r2.download_file(key)))
        current = r2.download_file(index_key(collection_id))
        newer = Faces.decode(current) if current else Faces.empty()
        merged = Faces.join([old.without(set(newer.names.tolist())), newer])
        if not r2.upload_file(merged.encode(), index_key(collection_id), "application/octet-stream"):
            raise RuntimeError(f"Could not save the face index of {collection_id}")
        r2.delete_files([key])
        print(f"[{datetime.now().isoformat()}] {collection_id}: {len(merged.names)} faces")
    return {"galleries": len(old_indexes)}

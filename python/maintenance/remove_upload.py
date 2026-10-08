"""Takes out an upload that was added twice by mistake: its faces from the gallery's search index, then its photos and
their smaller copies. Run `modal run python/modal_app.py::remove_upload --collection-id <id> --upload-id <id>`, then
pass the bytes it reports to `bunx convex run uploads:removeUpload` to refund the photos and correct the gallery.
"""

from datetime import datetime

from services.convex_client import ConvexService
from services.face_index import Faces, index_key
from services.r2_storage import R2StorageService


def remove_upload(collection_id: str, upload_id: str, r2=None, convex=None) -> dict:
    r2 = r2 or R2StorageService()
    convex = convex or ConvexService()
    # Gallery photo names start with their upload's tag (photoKey in packages/backend/convex/photoKeys.ts).
    tag = f"{upload_id[-8:]}-"
    # Merges rewrite the same index, so it's held like a merge and released the way one ends.
    if not convex.claim_face_index(collection_id):
        raise RuntimeError(f"{collection_id} is merging faces; try again in a minute")
    try:
        data = r2.download_file(index_key(collection_id))
        index = Faces.decode(data) if data else Faces.empty()
        kept = index.without({name for name in index.names.tolist() if name.startswith(tag)})
        faces = len(index.names) - len(kept.names)
        if faces and not r2.upload_file(kept.encode(), index_key(collection_id), "application/octet-stream"):
            raise RuntimeError(f"Could not save the face index of {collection_id}")
    finally:
        convex.faces_merged(collection_id, [])

    def files():
        return [item for folder in ("", "thumbs/", "screen/") for item in r2.list_objects(f"{collection_id}/{folder}{tag}")]

    found = files()
    r2.delete_files([item["Key"] for item in found])
    if left := files():
        raise RuntimeError(f"{len(left)} files of {upload_id} are still stored")
    # The gallery's size counts each photo and its thumbnail, not its screen version.
    billed = sum(item["Size"] for item in found if not item["Key"].startswith(f"{collection_id}/screen/"))
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {collection_id}: removed {faces} faces and {len(found)} files of {upload_id}, {billed:,} billed bytes")
    return {"faces": faces, "files": len(found), "stored_bytes": billed}

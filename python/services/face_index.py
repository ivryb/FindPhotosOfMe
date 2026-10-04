"""A gallery's faces, stored in R2 under {collection}/faces/: one row per face, with the photo it was found in.

Each processed batch writes its faces to its own file, so parallel workers never write the same file. Merges
fold batch files into index.npz, one merge per gallery at a time (Convex makes sure), and search reads every
file there. During a merge a photo can be in both the index and its batch file; matches are counted per photo.
"""

import io
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import numpy as np

MATCH_THRESHOLD = 0.6


def faces_prefix(collection_id: str) -> str:
    return f"{collection_id}/faces/"


def index_key(collection_id: str) -> str:
    return f"{collection_id}/faces/index.npz"


def batch_key(collection_id: str, batch_id: str) -> str:
    return f"{collection_id}/faces/{batch_id}.npz"


@dataclass
class Faces:
    names: np.ndarray       # the photo each face is in, by its name in the gallery
    embeddings: np.ndarray  # float16, one row per face; half precision halves what search downloads
    genders: np.ndarray     # 0 = female, 1 = male

    @staticmethod
    def of(photos: dict[str, list[dict]]) -> "Faces":
        """From each photo's faces as the face service returns them."""
        rows = [(name, face) for name, faces in photos.items() for face in faces]
        if not rows:
            return Faces.empty()
        return Faces(
            names=np.array([name for name, _ in rows]),
            embeddings=np.array([face["embedding"] for _, face in rows], dtype=np.float16),
            genders=np.array([face["gender"] for _, face in rows], dtype=np.int8),
        )

    @staticmethod
    def empty() -> "Faces":
        return Faces(np.array([], dtype=str), np.empty((0, 0), dtype=np.float16), np.array([], dtype=np.int8))

    @staticmethod
    def decode(data: bytes) -> "Faces":
        with np.load(io.BytesIO(data), allow_pickle=False) as file:
            return Faces(file["names"], file["embeddings"], file["genders"])

    @staticmethod
    def join(parts: list["Faces"]) -> "Faces":
        parts = [part for part in parts if len(part.names)]
        if not parts:
            return Faces.empty()
        return Faces(
            names=np.concatenate([part.names for part in parts]),
            embeddings=np.concatenate([part.embeddings for part in parts]),
            genders=np.concatenate([part.genders for part in parts]),
        )

    def encode(self) -> bytes:
        buffer = io.BytesIO()
        np.savez(buffer, names=self.names, embeddings=self.embeddings, genders=self.genders)
        return buffer.getvalue()

    def without(self, names: set[str]) -> "Faces":
        """Drops these photos' faces, so merging a batch file again replaces its faces instead of repeating them."""
        keep = ~np.isin(self.names, list(names)) if names else np.ones(len(self.names), dtype=bool)
        return Faces(self.names[keep], self.embeddings[keep], self.genders[keep])

    def match(self, embedding: list[float], gender: int, threshold: float = MATCH_THRESHOLD) -> list[tuple[str, float]]:
        """Photos with a face like this one, best match first."""
        if not len(self.names):
            return []
        faces = self.embeddings.astype(np.float32)
        reference = np.asarray(embedding, dtype=np.float32)
        scores = faces @ reference / (np.linalg.norm(faces, axis=1) * np.linalg.norm(reference))
        hits = (scores > threshold) & (self.genders == gender)
        best: dict[str, float] = {}
        for name, score in zip(self.names[hits].tolist(), scores[hits].tolist()):
            best[name] = max(best.get(name, -1.0), score)
        return sorted(best.items(), key=lambda match: match[1], reverse=True)


def load(r2, collection_id: str) -> Faces:
    """Every face in a gallery: its index and the batch files not merged into it yet."""
    keys = [item["Key"] for item in r2.list_objects(faces_prefix(collection_id))]
    with ThreadPoolExecutor(8) as pool:
        files = list(pool.map(r2.download_file, keys))
    return Faces.join([Faces.decode(data) for data in files if data])

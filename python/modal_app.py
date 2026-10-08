"""Deploy with: modal deploy python/modal_app.py."""

from pathlib import Path
import modal

SOURCE = Path(__file__).parent
app = modal.App("findphotosofme")
secret = modal.Secret.from_name("findphotosofme-backend")

# Mount only application sources; never send .env files, venvs or local models.
def application_source(path: Path) -> bool:
    relative = path.relative_to(SOURCE) if path.is_absolute() else path
    return not (path.suffix == ".py" and relative.parts[0] in {
        "main.py", "security.py", "endpoints", "schemas", "services", "maintenance",
    })

base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi==0.109.0", "pydantic==2.5.3", "python-multipart==0.0.6",
                 "python-dotenv==1.0.0", "boto3==1.34.162", "convex==0.7.0")
    .env({"PYTHONPATH": "/app"})
)
web_image = base_image.add_local_dir(SOURCE, "/app", ignore=application_source)
model_image = (
    base_image.apt_install("libgl1", "libglib2.0-0", "libgomp1", "build-essential")
    .pip_install("patchelf==0.19.1.0")
    .pip_install_from_requirements(SOURCE / "requirements.txt")
    .run_commands(
        "find /usr/local/lib/python3.11/site-packages/onnxruntime/capi -name '*.so' -exec patchelf --clear-execstack {} \\;",
        "python -c \"from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', root='/opt/insightface', providers=['CPUExecutionProvider'])\"",
    )
    .env({"INSIGHTFACE_ROOT": "/opt/insightface", "OMP_NUM_THREADS": "2"})
    .add_local_dir(SOURCE, "/app", ignore=application_source)
)


# Up to MAX_RUNNING_BATCHES in packages/backend/convex/uploads.ts run at once. A batch must finish well within
# STALLED_AFTER there (10 minutes), after which Convex gives it to another worker; 50 photos take about 2 minutes.
# Containers stay up a minute between batches, so a long upload doesn't reload the model for each one.
@app.function(image=model_image, secrets=[secret], cpu=1, memory=4096,
              min_containers=0, max_containers=10, scaledown_window=60,
              timeout=480, retries=0)
def process_batch(batch_id: str):
    from endpoints.photo_batches import process_batch as run
    return run(batch_id)


# One merge per gallery at a time; like batches, well within STALLED_AFTER.
@app.function(image=model_image, secrets=[secret], cpu=1, memory=2048,
              min_containers=0, max_containers=4, scaledown_window=10,
              timeout=300, retries=0)
def merge_faces(collection_id: str, batch_ids: list[str]):
    from endpoints.photo_batches import merge_faces as run
    return run(collection_id, batch_ids)


@app.function(image=model_image, secrets=[secret], cpu=1, memory=2048,
              min_containers=0, max_containers=2, scaledown_window=60,
              timeout=300, retries=0)
def search(search_request_id: str, reference_data: bytes):
    from endpoints.search_photos import process_search
    return process_search(search_request_id, reference_data)


@app.function(image=web_image, secrets=[secret], cpu=0.125, memory=256,
              min_containers=0, max_containers=2, scaledown_window=10)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def web():
    from main import create_app
    return create_app(submit_batch=process_batch.spawn.aio, submit_merge=merge_faces.spawn.aio, execute_search=search.remote.aio)


@app.function(image=model_image, secrets=[secret], cpu=1, memory=2048, timeout=7200, retries=0)
def backfill_thumbnails():
    """One-time: thumbnails and sizes for galleries made before they existed. `modal run python/modal_app.py::backfill_thumbnails`"""
    from maintenance.backfill_thumbnails import backfill_thumbnails as run
    return run()


# Four cores for the eight photos the backfill makes at once.
@app.function(image=model_image, secrets=[secret], cpu=4, memory=4096, timeout=7200, retries=0)
def backfill_screens(collection_id: str | None = None):
    """One-time: screen versions for photos processed before they existed. Safe to rerun and during uploads.
    One gallery: `modal run --detach python/modal_app.py::backfill_screens --collection-id <id>`; all galleries:
    `modal run --detach python/modal_app.py::backfill_screens`"""
    from maintenance.backfill_screens import backfill_screens as run
    return run(collection_id)


@app.function(image=model_image, secrets=[secret], cpu=1, memory=4096, timeout=3600, retries=0)
def convert_face_indexes():
    """One-time, right after deploying: old face indexes to the new format. `modal run python/modal_app.py::convert_face_indexes`"""
    from maintenance.convert_face_indexes import convert_face_indexes as run
    return run()

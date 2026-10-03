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
        "main.py", "security.py", "endpoints", "schemas", "services",
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


@app.function(image=model_image, secrets=[secret], cpu=1, memory=4096,
              min_containers=0, max_containers=1, scaledown_window=10,
              timeout=7200, retries=0)
def ingest(job_id: str, collection_id: str, file_key: str):
    from endpoints.upload_collection import process_ingest_job
    return process_ingest_job(job_id, collection_id, file_key)


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
    return create_app(submit_ingest=ingest.spawn.aio, execute_search=search.remote.aio)

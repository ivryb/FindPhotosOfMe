# FindPhotosOfMe

Find photos of yourself from a large conference/gallery by uploading a single reference photo. The system searches thousands of images stored in Google Cloud Storage and returns matches.

This repo contains:

- `apps/web` — Nuxt frontend
- `packages/backend/convex` — Convex backend (schema + functions)
- `python` — Python search service source and assets

## Architecture

- **Frontend (Nuxt, `apps/web`)**: Uploads a reference photo, shows search job status and results.
- **Backend (Convex, `packages/backend/convex`)**: Persists jobs, tracks status/results, and triggers the search worker.
- **Search Worker (Python in Docker, GCP)**: Picks up jobs, scans photos in GCS, performs face detection/embedding and similarity search, writes results, and signals completion.
- **Storage (GCS)**: Buckets for photo library, user uploads, and optional precomputed embeddings.
- **Messaging (Pub/Sub)**: Decouples job submission from processing and enables parallelism/fan-out.

### Data flow

1. User uploads a reference image via the Nuxt app → stored in `gs://<uploads-bucket>`.
2. Convex creates a search job and publishes a Pub/Sub message (`search-requests`).
3. Python worker (Cloud Run or Cloud Functions Gen2 container) consumes the message, reads from `gs://<library-bucket>`, computes/loads embeddings, performs similarity search.
4. Worker writes results to Convex (and/or `gs://<results-bucket>`), updates job status.
5. Frontend subscribes to job updates via Convex and displays results.

## Why Cloud Run (vs. Cloud Functions) for the worker

- Cloud Run provides better control over CPU/memory/GPU, concurrency, startup command, and max instances. It’s ideal for heavier ML/vision workloads and parallel processing.
- Cloud Functions Gen2 can also run containers and is fine for simple triggers, but for long-running or resource-tuned workloads Cloud Run is typically the safer default.

You can still use Cloud Functions Gen2 as a thin Pub/Sub trigger that forwards to Cloud Run if needed.

## Parallelism strategy

- Use Pub/Sub to shard work. For example, publish one message per batch of N photos or per library shard (e.g., prefix-based partitions).
- Configure Cloud Run autoscaling (max instances) and set suitable concurrency (often `1` for CPU-bound/OpenCV/ONNX inference to avoid contention; increase if profiling shows headroom).
- For very large libraries, precompute embeddings and store them in GCS or a vector index (FAISS/ScaNN) to make per-job work O(1) embedding + fast vector search.

## Monorepo layout

```
FindPhotosOfMe/
├── apps/web                  # Nuxt UI
├── packages/backend/convex   # Convex functions, schema, jobs API
└── python                    # Python worker and Docker context
```

## Dev commands

- `pnpm install` — install workspace dependencies
- `pnpm dev:setup` — set up Convex for development
- `pnpm dev` — run web + backend locally, then open http://localhost:3001

## Google Cloud setup

1. Create/select a GCP project.
2. Enable APIs: Artifact Registry, Cloud Run, Cloud Build, Pub/Sub, Cloud Storage, Secret Manager (and Cloud Functions if used).
3. Create buckets (names are examples; pick your own):
   - `gs://fpo-library` — conference photo library
   - `gs://fpo-uploads` — user reference images
   - `gs://fpo-results` — optional JSON/results artifacts
4. Create Pub/Sub topics and subscriptions:
   - Topic: `search-requests`
   - (Optional) Topic: `search-completed`
5. Artifact Registry repository for images, e.g. `us-docker.pkg.dev/<PROJECT>/find-photos`.
6. Service account for the worker with roles: `Storage Object Admin`, `Pub/Sub Subscriber`, `Pub/Sub Publisher` (if emitting events), and access to Convex credentials via Secret Manager.

## Docker packaging guidance (Python worker)

Yes — bake all Python dependencies into the image. Avoid `pip install` on startup. Prefer multi-stage builds and pinned versions for reproducible, fast cold starts.

Minimal CPU image example:

```Dockerfile
FROM python:3.12-slim AS base

# System deps often needed by OpenCV/ONNX/InsightFace
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libgl1 \
      libglib2.0-0 \
      git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install deps first to maximize Docker layer caching
COPY python/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker code
COPY python/ /app/

# Environment (examples)
ENV GCP_PROJECT="" \
    GCS_LIBRARY_BUCKET="" \
    GCS_UPLOADS_BUCKET="" \
    GCS_RESULTS_BUCKET="" \
    PUBSUB_TOPIC_REQUESTS="search-requests" \
    CONVEX_URL="" \
    CONVEX_DEPLOYMENT="" \
    CONVEX_ADMIN_KEY=""

CMD ["python", "-m", "main"]
```

Typical `requirements.txt` (pin versions after testing):

```text
insightface==0.7.3
onnxruntime==1.19.2
opencv-python-headless==4.10.0.84
numpy==2.1.1
pillow==10.4.0
google-cloud-storage==2.18.2
google-cloud-pubsub==2.22.0
fastapi==0.114.0  # or Flask if you prefer
uvicorn==0.30.6   # if exposing HTTP endpoint on Cloud Run
```

Notes:

- If you need GPU acceleration, use a CUDA base image compatible with ONNX Runtime GPU and run on Cloud Run with GPU. Size and cold start will increase.
- Pre-download model weights at build time when license allows, or cache them at runtime in a writable directory (`/tmp` on Cloud Run) to avoid repeated downloads per instance.
- Keep the image small. Avoid installing compilers and git at runtime; only at build time.
- Use `pip download` in a builder stage to prefetch wheels if wheels are not available for your platform.

### Build and deploy (Artifact Registry + Cloud Run)

```bash
# Authenticate gcloud and set project
gcloud auth login
gcloud config set project <PROJECT_ID>

# Build with Cloud Build and push to Artifact Registry
gcloud builds submit --tag us-docker.pkg.dev/<PROJECT_ID>/find-photos/worker:latest .

# Deploy to Cloud Run (Pub/Sub push requires an HTTP endpoint)
gcloud run deploy fpo-worker \
  --image us-docker.pkg.dev/<PROJECT_ID>/find-photos/worker:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated=false \
  --max-instances 50 \
  --cpu 2 --memory 2Gi \
  --concurrency 1 \
  --set-env-vars GCS_LIBRARY_BUCKET=fpo-library,GCS_UPLOADS_BUCKET=fpo-uploads,GCS_RESULTS_BUCKET=fpo-results,PUBSUB_TOPIC_REQUESTS=search-requests,CONVEX_URL=<url>,CONVEX_DEPLOYMENT=<id>

# Create a Pub/Sub push subscription pointing to the worker's endpoint
gcloud pubsub subscriptions create search-requests-sub \
  --topic=search-requests \
  --push-endpoint="https://<cloud-run-url>/pubsub" \
  --push-auth-service-account=<SERVICE_ACCOUNT_EMAIL>
```

If you prefer pull-based consumption, run a background polling loop instead of an HTTP endpoint and trigger via Cloud Scheduler or a small Gen2 Function.

## Convex integration

- Define a job schema (`packages/backend/convex/schema.ts`) with fields for status, input reference, and result IDs.
- Provide mutations to create jobs and actions to publish Pub/Sub messages.
- Provide queries to read job status and results.

Environment variables for Convex (example): `CONVEX_DEPLOYMENT`, `CONVEX_ADMIN_KEY`, plus bucket/topic names used by actions.

## Frontend (Nuxt) integration

- Upload reference photo to `gs://<uploads-bucket>` (direct upload with signed URL or via backend proxy).
- Create a search job via Convex and show a progress state.
- Poll Convex or subscribe to updates; render the ranked result images on completion.

## Local development

- Web + backend: `pnpm dev` (after `pnpm dev:setup`) then open http://localhost:3001.
- Worker locally:
  - Create `.env` with the variables shown above.
  - `docker build -t fpo-worker:dev .`
  - `docker run --env-file .env fpo-worker:dev`

## Implementation notes and recommendations

- Precompute library embeddings offline and store as shard files in GCS (e.g., Parquet/NumPy) to drastically reduce per-job latency.
- Use FAISS (CPU) or ScaNN for vector search if the library grows beyond a few tens of thousands of photos.
- Keep max Cloud Run instances high enough to meet demand, but cap to control cost.
- Use Secret Manager for Convex keys and other secrets; do not commit them.

---

This README replaces boilerplate with a concrete plan for building and deploying FindPhotosOfMe using Nuxt, Convex, and a containerized Python worker on Google Cloud.

# Plan

- [x] Vue/Nuxt: install shadcn-vue + theme
- [ ] Vue/Nuxt: admin's UI to create collections/events and upload photo libraries
  - [ ] GCP integration to store photos
  - [ ] Python endpoint to analyze photos and store embeddings
  - [ ] Convex DB schema & logic

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
- **Triggering (HTTP)**: Convex action sends an HTTP POST to Cloud Run with `{ jobId, refImageId }`. Cloud Run returns 202 and processes async.
- **Optional messaging (Pub/Sub)**: For advanced scaling (fan-out, retries, backpressure) you can switch to or add Pub/Sub.

### Data flow

1. User uploads a reference image via the Nuxt app → stored in `gs://<uploads-bucket>`.
2. Convex creates a search job and calls the Cloud Run endpoint (HTTP) with `{ jobId, refImageId }`.
3. Python worker fetches the reference and library images from GCS, computes/loads embeddings, performs similarity search.
4. Worker writes progress and results back to Convex, updates job status.
5. Frontend subscribes to job updates via Convex and displays results.

## Why Cloud Run (vs. Cloud Functions) for the worker

- Cloud Run provides better control over CPU/memory/GPU, concurrency, startup command, and max instances. It’s ideal for heavier ML/vision workloads and parallel processing.
- Cloud Functions Gen2 can also run containers and is fine for simple triggers, but for long-running or resource-tuned workloads Cloud Run is typically the safer default.

You can still use Cloud Functions Gen2 as a thin trigger or for periodic orchestration if needed.

## Parallelism strategy

- Shard work at the application layer (e.g., one job per library shard or per batch). Scale Cloud Run instances and keep concurrency low for CPU-bound inference.
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
4. (Optional) Create Pub/Sub topics if you adopt Pub/Sub later:
   - Topic: `search-requests`
   - (Optional) Topic: `search-completed`
5. Artifact Registry repository for images, e.g. `us-docker.pkg.dev/<PROJECT>/find-photos`.
6. Service account for the worker with roles: `Storage Object Admin`, and if using Pub/Sub, `Pub/Sub Subscriber`/`Publisher`. Grant access to Convex credentials via Secret Manager if used.

## Docker packaging (Python worker)

The `python/` directory contains the working code and dependencies for the worker. Build the container image using `python/` as the context. All dependency management lives there, so we avoid duplicating details in this README.

### Build and deploy (Artifact Registry + Cloud Run)

```bash
# Authenticate gcloud and set project
gcloud auth login
gcloud config set project <PROJECT_ID>

# Build with Cloud Build and push to Artifact Registry (use python/ as context)
gcloud builds submit python --tag us-docker.pkg.dev/<PROJECT_ID>/find-photos/worker:latest

# Deploy to Cloud Run (HTTP endpoint)
gcloud run deploy fpo-worker \
  --image us-docker.pkg.dev/<PROJECT_ID>/find-photos/worker:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated=false \
  --max-instances 50 \
  --cpu 2 --memory 2Gi \
  --concurrency 1 \
  --set-env-vars GCS_LIBRARY_BUCKET=fpo-library,GCS_UPLOADS_BUCKET=fpo-uploads,GCS_RESULTS_BUCKET=fpo-results,CONVEX_URL=<url>
```

If you later choose Pub/Sub push, expose a `/pubsub` endpoint and create a push subscription to that URL.

## HTTP-triggered worker + Convex Python SDK

- Trigger: Convex action POSTs to Cloud Run (e.g., `POST https://<cloud-run-url>/jobs`) with `{ jobId, refImageId }`. Cloud Run returns 202 immediately and starts async work.
- Progress/results back to Convex: use the Convex Python SDK from the worker to call an action that updates job status and persists results. See the Quickstart for client usage: [Convex Python Quickstart](https://docs.convex.dev/quickstart/python).

Example (worker):

```python
import os
from convex import ConvexClient

client = ConvexClient(os.environ["CONVEX_URL"])  # e.g. https://<deployment>.convex.cloud

client.action(
    "jobs:updateProgress",
    {
        "jobId": job_id,
        "stage": "embedding",
        "percent": 20,
        "secret": os.environ.get("CONVEX_WORKER_SECRET"),
    },
)
```

### Reliability

- Make progress updates idempotent (key by `{ jobId, step }`).
- Keep the Convex action that triggers the worker fast (enqueue/send only). The worker should not block that action.

## Option: Convex Vector Search for retrieval

Convex has a managed vector search you can use for image similarity. Store image embeddings in a Convex table with a vector index, then perform similarity search from an action. Docs: [Convex Vector Search](https://docs.convex.dev/search/vector-search).

Schema example (`packages/backend/convex/schema.ts`):

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  photoEmbeddings: defineTable({
    imagePath: v.string(), // gs://... or public URL
    conferenceId: v.string(), // optional filter field
    embedding: v.array(v.float64()),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 512, // match your model (e.g., 512)
    filterFields: ["conferenceId"],
  }),
});
```

Action example (search by a reference embedding):

```ts
import { v } from "convex/values";
import { action, internal } from "./_generated/server";

export const similarPhotos = action({
  args: {
    conferenceId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("photoEmbeddings", "by_embedding", {
      vector: args.embedding,
      limit: args.limit ?? 50,
      filter: (q) => q.eq("conferenceId", args.conferenceId),
    });
    // Optionally load documents by ID to return metadata/paths
    const docs = await ctx.runQuery(internal.photos.fetchByEmbeddingIds, {
      ids: results.map((r) => r._id),
    });
    return docs;
  },
});
```

Operational choices:

- Precompute embeddings once (Cloud Run batch) and insert into Convex. At query time, compute only the reference embedding and call the action to run vector search.
- For small/medium libraries (e.g., up to hundreds of thousands), this keeps search fully managed and low-latency. For very large libraries, shard by `conferenceId` or additional fields.
- Keep vector dimensions and filters aligned with your embedding model and query needs.

## Convex integration

- Define a job schema (`packages/backend/convex/schema.ts`) with fields for status, input reference, and result IDs.
- Provide mutations to create jobs and actions to call the worker (HTTP) and to accept worker progress updates.
- Provide queries to read job status and results.

Environment variables for Convex (example): `CONVEX_DEPLOYMENT`, `CONVEX_ADMIN_KEY` (if used), plus bucket names.

## Frontend (Nuxt) integration

- Upload reference photo to `gs://<uploads-bucket>` (direct upload with signed URL or via backend proxy).
- Create a search job via Convex and show a progress state.
- Poll Convex or subscribe to updates; render the ranked result images on completion.

## Local development

- Web + backend: `pnpm dev` (after `pnpm dev:setup`) then open http://localhost:3001.

## Implementation notes and recommendations

- Precompute library embeddings offline and store as shard files in GCS (e.g., Parquet/NumPy) to drastically reduce per-job latency.
- Use FAISS (CPU) or ScaNN for vector search if the library grows beyond a few tens of thousands of photos.
- Keep max Cloud Run instances high enough to meet demand, but cap to control cost.
- Use Secret Manager for sensitive keys; do not commit them.

---

This README focuses on architecture and deployment. See `python/` for the worker’s code and dependencies.

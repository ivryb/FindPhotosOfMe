# Photo processing on Modal

The Python backend runs on Modal as `findphotosofme` in workspace `ivryb`.

- HTTP endpoint: https://ivryb--findphotosofme-web.modal.run
- Deployment: https://modal.com/apps/ivryb/main/deployed/findphotosofme
- Photos, uploads waiting to be processed, and face indexes are in Cloudflare R2.
- Gallery, upload and search state are in Convex (`honorable-firefly-904`).
- The model is unchanged: InsightFace `buffalo_l`, running on CPU.

## Deployment

Authenticate with `modal setup`, then from the repository root:

```sh
uv tool run --from modal==1.6.0 modal deploy python/modal_app.py
```

`modal_app.py` builds the model image and downloads weights during the image
build. Application source is mounted separately so code-only deployments reuse
that image. Only Python application files are included; `.env`, tests and local
model directories are excluded.

The Modal Secret `findphotosofme-backend` contains:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
CONVEX_URL
SERVICE_TOKEN
OPENAI_API_KEY
```

`SERVICE_TOKEN` must match Convex's `SERVICE_TOKEN` and the web app's private
`NUXT_SERVICE_TOKEN`. `OPENAI_API_KEY` is used only for the free moderation
endpoint; guest uploads fail without it. Keep these values out of source
control. Modal's CLI credentials are separate from the application's service
token. To change one key, use the SDK's `modal.Secret.update`, which keeps the
others; the CLI can only replace the whole secret.

After testing a new endpoint, set `PYTHON_API_URL` in Convex and
`NUXT_PYTHON_API_URL` in the frontend. See [the Cloudflare handoff](../docs/modal-handoff.md).

## Execution

The browser unpacks ZIPs itself and uploads photos straight to R2 in batches of
up to 50 under `uploads/{collection}/{batch}/`. Convex reserves the owner's
credit before issuing upload URLs for exact filenames and sizes. After the web
server verifies that every file arrived, Convex charges and queues the batch;
abandoned reservations are released after the URLs expire and staging files are
removed. Older batches retain their `uploads/{collection}/{upload}/` paths.
Convex (`packages/backend/convex/uploads.ts`) hands queued batches to a worker
here; the small FastAPI web function authenticates the request
and spawns the Modal job. `POST /api/process-batch` and `POST /api/merge-faces`
return HTTP **202 Accepted**; results arrive in Convex. `POST /api/search-photos`
awaits the search worker and returns HTTP **200** after matching, which the web
and Telegram flows rely on.

- **Batches**: up to 10 workers at once (Convex's `MAX_RUNNING_BATCHES`), 1 CPU /
  4 GiB, eight-minute limit; 50 photos take about two minutes. A worker finds
  faces, saves a 640px thumbnail and a 2048px screen version (WebP) under
  `thumbs/` and `screen/`, copies kept photos into the gallery inside R2,
  and writes the batch's faces to `{collection}/faces/{batch}.npz`. Crowdsourced
  galleries keep every valid photo, including those without faces; ordinary
  galleries still discard and refund photos without faces. The batch records
  this policy when submitted, so closing contributions does not discard queued
  guest photos. Unreadable files are skipped and refunded without failing the
  other photos in the batch. Every kept photo, from owners and guests alike, is
  also screened by OpenAI's moderation endpoint, using its thumbnail; sexual
  content, gore and self-harm are skipped and refunded the same way. If
  moderation stays unreachable, the batch fails and is retried.
- **Moderation limits**: OpenAI's [model page](https://developers.openai.com/api/docs/models/omni-moderation-latest)
  (checked October 2026) lists these per-account limits for
  `omni-moderation-latest`. The endpoint is free, sends no rate-limit headers,
  and takes images up to 20 MB.

  | OpenAI tier | Requests/minute | Requests/day | Tokens/minute |
  | ----------- | --------------- | ------------ | ------------- |
  | Free        | 250             | 5,000        | 10,000        |
  | Build       | 500             | none         | 20,000        |
  | Launch      | 2,000           | none         | 250,000       |
  | Grow        | 5,000           | none         | 500,000       |

  One request per kept photo. Ten workers at about 25 photos a minute each peak
  near 250 requests a minute, so the Free tier is at its edge and caps a day at
  5,000 photos; Build or higher covers a full queue. A rejected request is
  retried three times, then the batch is retried, and a batch that fails all
  three tries is refunded without its photos.
- **Merges**: fold finished batch files into `{collection}/faces/index.npz`, one
  merge per gallery at a time, up to four galleries at once, five-minute limit.
- **Search**: up to two workers, 1 CPU / 2 GiB, five-minute limit. It reads the
  index plus any batch files not merged yet.
- Each worker handles one input at a time and keeps its face model loaded.
  Batch workers stay up a minute between inputs so long uploads don't reload it.
  No GPU or persistent Modal Volume is provisioned.

Convex's `recover` (every two minutes) retries a batch or merge that has no
result ten minutes after it started; the time limits above are shorter, so the
first worker is gone by then. A batch is tried three times, then its photos are
refunded and counted as failed. A worker that hits an error reports it, and the
batch is retried right away. Both kinds of work are safe to run twice: keys are
fixed by Convex, the first result for a batch counts, and merging a batch file
again replaces its faces instead of repeating them.

## HTTP interface

Every processing request requires `Authorization: Bearer <SERVICE_TOKEN>`.
`GET /health` is public and checks HTTP service availability, not model readiness.

- `POST /api/process-batch` takes `{"batch_id": "<Convex upload batch ID>"}`.
- `POST /api/merge-faces` takes `{"collection_id": "<gallery ID>", "batch_ids": ["<batch ID>", ...]}`.
- `POST /api/search-photos` takes multipart fields `search_request_id` (an
  existing Convex search record) and `reference_photo` (JPEG/PNG/WebP, up to 10 MiB).

Telegram result delivery is owned by the Convex/frontend integration, not Python.

## Local development and validation

Use Python 3.11:

```sh
pip install -r python/requirements.txt
cd python
uvicorn main:app --port 8000
```

Copy `.env.example` to `.env` and provide credentials. Without Modal submission
callbacks, local requests execute the same processing functions in a threadpool
and wait for completion. The first local inference downloads the model under
`INSIGHTFACE_ROOT` (default: current directory).

Behavior tests use fake external services, real face index files and the
FastAPI request interface. They do not download the model:

```sh
bun run test:python   # from the repository root; uv installs requirements-test.txt on first run
```

Live verification is recorded in [the migration handoff](../docs/modal-handoff.md).
It exercises actual Modal CPU inference, R2 writes and Convex state transitions.

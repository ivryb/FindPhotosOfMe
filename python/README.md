# Photo processing on Modal

The Python backend runs on Modal as `findphotosofme` in workspace `ivryb`.

- HTTP endpoint: https://ivryb--findphotosofme-web.modal.run
- Deployment: https://modal.com/apps/ivryb/main/deployed/findphotosofme
- Photos, source archives and face indexes remain in Cloudflare R2.
- Collection, import and search state remain in Convex (`honorable-firefly-904`).
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
```

`SERVICE_TOKEN` must match Convex's `SERVICE_TOKEN` and the web app's private
`NUXT_SERVICE_TOKEN`. Keep these values out of source control. Modal's CLI
credentials are separate from the application's service token.

After testing a new endpoint, set `PYTHON_API_URL` in Convex and
`NUXT_PYTHON_API_URL` in the frontend. See [the Cloudflare handoff](../docs/modal-handoff.md).

## Execution

The small FastAPI web function validates/authenticates submissions and spawns
Modal jobs. `POST /api/process-ingest-job` returns HTTP **202 Accepted**; observe
completion in Convex. `POST /api/search-photos` awaits the separate search worker
and returns HTTP **200** after matching, preserving the existing web and Telegram
contract. Search results are also stored in Convex.

- Ingestion: one worker container, 1 CPU / 4 GiB, two-hour function timeout.
- Search: up to two worker containers, 1 CPU / 2 GiB, five-minute timeout.
- Each worker handles one input at a time and caches its face model for reuse.
- All functions have zero minimum containers. Ingest/API idle retention is
  10 seconds; search retention is 60 seconds. Startup and retained idle time
  are billable. No GPU or persistent Modal Volume is provisioned.

Archives are streamed from R2 to temporary disk and read one image at a time.
Limits: 2 GiB compressed, 20 GiB expanded, 10,000 archive entries, 50 MiB per
image, and the event's photo allowance. Temporary files are removed after work.

Imports use job-prefixed deterministic photo keys. Replaying an interrupted
job replaces that job's results rather than duplicating them or overwriting
another archive's files. Completed jobs are skipped on replay. The source ZIP
is deleted only after the index and completion state are saved; failed jobs
retain it for the existing Retry action.

Modal can replay inputs after infrastructure interruption. Ordinary processing
errors mark the Convex job failed; application-error retries are disabled.
A hard timeout or repeated OOM still needs operational attention: inspect the
Modal call before manually correcting a stuck `running` record. There is no
new scheduler or watchdog for this low-usage deployment.

## HTTP interface

Every processing request requires `Authorization: Bearer <SERVICE_TOKEN>`.
`GET /health` is public and checks HTTP service availability, not model readiness.

`POST /api/process-ingest-job` accepts JSON:

```json
{"job_id":"<Convex ingest job ID>","collection_id":"<collection ID>","file_key":"<R2 ZIP key>"}
```

The job must already exist and reference that collection and R2 object.
Convex normally claims and submits jobs through `ingest:dispatchNextForCollection`.

`POST /api/search-photos` accepts multipart fields `search_request_id` (an
existing Convex search record) and `reference_photo` (JPEG/PNG/WebP, up to 10 MiB).

The old unused `/api/upload-collection` and misleading
`/api/process-ingest-job-start` routes have been removed. Upload ZIPs to R2,
create an ingest job using the application, then let Convex dispatch it.
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

Behavior tests use fake external services, real ZIP parsing and the FastAPI
request interface. They do not download the model:

```sh
pip install fastapi==0.109.0 pydantic==2.5.3 python-multipart==0.0.6 \
  python-dotenv==1.0.0 boto3==1.34.162 convex==0.7.0 pytest httpx==0.27.2
python -m pytest python/tests -q
```

Live verification is recorded in [the migration handoff](../docs/modal-handoff.md).
It exercises actual Modal CPU inference, R2 writes and Convex state transitions.

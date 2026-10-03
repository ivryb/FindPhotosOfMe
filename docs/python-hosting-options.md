# Python hosting options

Research date: 2 October 2026. Recommendation for discussion, not a deployment decision. No production changes were made.

## Recommendation

**Shortlist Railway and Modal.** Railway best matches the request for a friendly managed service with minimal deployment ceremony. Modal better matches sporadic inference and long photo-ingestion jobs, but introduces a platform-specific Python adapter. Keep Convex and R2 with either. Choose after benchmarking the same licensed model and representative archive on both; do not select on headline free-tier prices.

For Railway, begin with a 4 GiB memory ceiling and up to 2 vCPU as an experiment, with sleeping disabled during event activity. This is a starting configuration, not a proven capacity requirement. A 2 GB archive plus its in-memory copy, image decoding, model, and JSON embeddings can exceed 4 GiB; reduce buffering or constrain archive sizes before calling that configuration production-safe.

**Cloudflare Containers is a credible third candidate**, especially if consolidating providers is the priority. Ordinary Workers are not a drop-in host for the current native Python/ONNX Docker image. Containers can run the image, but add Worker/Durable Object routing and lifecycle work. Prefer an isolated feasibility benchmark before committing to an all-Cloudflare design.

The current Google bill does not establish a cost-saving case for migration. The older [portfolio note](portfolio-launch.md) records July 2026 spending of $3.157479, mostly Artifact Registry ($2.612525). This is historical repository evidence, not a newly verified invoice. Ivan's current preference to leave Google Cloud supersedes that note's earlier recommendation to stay.

## What the code actually needs

| Observation | Consequence |
| --- | --- |
| [Dockerfile.python](../Dockerfile.python) runs Python 3.11 and `uvicorn main:app`, with native OpenCV, InsightFace and ONNX Runtime dependencies. | A Linux container is the smallest migration unit. The old Flask/GCS code in `python/app.py` is not this Docker entrypoint. |
| [FaceRecognitionService](../python/services/face_recognition_service.py) uses `buffalo_l`, `CPUExecutionProvider`, 640×640 detection, and `root='.'`. | No GPU is required by current code. Preserve the actual CPU architecture/runtime compatibility in testing; do not assume every ARM or micro-VM target behaves identically. Models live under the app's model cache; the Dockerfile does not pre-download them. |
| Both upload and search endpoints construct `FaceRecognitionService()` on every request. | A warm container still reloads model sessions. Cache model initialization once per process, with bounded inference concurrency, before measuring the final UX. |
| [Upload processing](../python/endpoints/upload_collection.py) downloads the ZIP into bytes, wraps it in `BytesIO`, and processes images sequentially. Limits permit 2 GiB compressed, 20 GiB expanded and 10,000 archive members. | R2 references avoid an HTTP upload bottleneck but do not avoid RAM pressure. Stream/download to temporary disk and open the ZIP there, or impose a smaller product limit. Do not size RAM from model-file size alone. |
| CPU work, R2 calls and Convex calls run synchronously inside `async` routes; the container starts one Uvicorn process. | Ingest can block search and even health requests in that process. Moving hosts alone does not make attendee searches responsive. Separate bounded execution from HTTP handling; measure simultaneous ingestion/search before adding replicas. |
| [Convex dispatch](../packages/backend/convex/ingest.ts) awaits the whole `/api/process-ingest-job` HTTP response. The alternate `-start` route also awaits completion despite its comment. | This is not a durable asynchronous execution boundary. Long archives can hit provider or caller time limits. Existing [ingestJobs](../packages/backend/convex/ingestJobs.ts) already provides pending/running/completed/failed state and per-collection serialization; preserve it. |
| [Search](../python/endpoints/search_photos.py) fetches and parses a collection's entire embeddings JSON per query and loops through it in Python. It also filters by predicted gender. | Large-event search cost grows with face count; benchmark crowded photographs. Gender filtering is an accuracy concern to evaluate before promising reliable results. |
| [R2 storage](../python/services/r2_storage.py) holds photos/embeddings; Convex holds application state. [Service authentication](../python/security.py) checks a server token. | No photograph/database migration is needed. Preserve the token boundary and private R2 access. Nuxt and Convex need the new private server-side service URL. |

These observations describe the current local working tree, which includes existing uncommitted changes. They do not prove what revision is deployed.

## Commercial model licensing is a launch dependency

InsightFace distinguishes MIT-licensed code from pretrained model rights. Its official licensing page explicitly lists `buffalo_l` among packages needing separate commercial usage rights. The model cannot be assumed commercially licensed because `insightface` is open source. No license agreement was found in the inspected materials, and no public price was established. Obtain a quote/confirm an existing agreement, or evaluate a model with documented rights for this product before accepting paid events. [InsightFace model licensing](https://www.insightface.ai/solutions/face-recognition-licensing), [upstream license statement](https://github.com/deepinsight/insightface/blob/master/server/docs/user-guide.md).

If changing embedding models, re-index existing photos and validate matching thresholds; embeddings from unrelated models are not interchangeable. Preserve the current model for a hosting-only benchmark only where its usage is authorized. Model pricing could matter more than the difference between two small cloud bills.

## Provider comparison

Prices are USD before tax unless marked EUR. Excludes Convex, R2, payment fees and model licensing. Resource shapes are comparison points, not measured requirements.

| Platform | Current price reference | Fit and tradeoff |
| --- | --- | --- |
| **Railway** | $5 Hobby/$20 Pro monthly minimum, each credited toward usage. RAM $10/GB-month, CPU $20/vCPU-month based on consumption; egress $0.05/GB, volumes $0.15/GB-month. | Best simple-service candidate. Reuse Dockerfile, environment variables and health endpoint. RAM remains billable while warm. Sleep introduces cold starts. [Pricing](https://docs.railway.com/pricing/plans). |
| **Modal** | CPU $0.0000131 per physical core-second (provider calls one core roughly two vCPUs); memory $0.00000222/GiB-second. Starter includes $30/month compute credits. | Best bursty-job candidate. ASGI support can retain FastAPI; a managed function can handle long ingestion independently of the HTTP request. Requires a Modal adapter and explicit retry semantics. [Pricing](https://modal.com/pricing), [FastAPI support](https://modal.com/docs/guide/webhooks). |
| **Northflank** | 1 dedicated vCPU/4 GB $36/month; 2 dedicated vCPU/4 GB $48/month; egress $0.06/GB. | Strong predictable-price alternative with Docker builds, UI, secrets and metrics. More platform surface than this small service needs, but less operating work than a VPS. [Pricing and included features](https://northflank.com/pricing). |
| **Render** | 1 CPU/2 GB $25/month; 2 CPU/4 GB $85/month. Hobby workspace $0 plus compute; Pro workspace $25 plus compute. | Straightforward Docker web services/workers. The 4 GB price is comparatively high; the cheaper 2 GB tier is not established as safe for this workload. [Pricing](https://render.com/pricing), [compute shapes](https://render.com/docs/compute-plans). |
| **Fly.io** | Pricing page baseline: performance-1x/2 GB $31/month; performance-2x/4 GB $62/month. Region affects prices; storage/egress are separate. | Container Machines with configurable autostop/autostart; more CLI/configuration-oriented. Shared CPU is cheaper but uses burst credits, so avoid assuming shared cores deliver sustained ingestion throughput. [Pricing](https://fly.io/pricing/), [CPU behavior](https://docs.fly.io/machines/cpu-performance), [autostop](https://docs.fly.io/launch/autostop-autostart). |
| **Cloudflare Containers** | Workers Paid $5/month; beyond allowances, memory $0.009/GiB-hour, active CPU $0.072/vCPU-hour, disk $0.000252/GB-hour. | Can consolidate infrastructure. Memory/disk are charged on provisioned capacity while running; CPU on active usage. Worker, Durable Object and logs charges also apply. [Pricing](https://developers.cloudflare.com/containers/platform/pricing/). |
| **Hetzner Cloud** | CX23 Germany/Finland: €5.49/month excluding VAT and IPv4 after the June 2026 adjustment. | Low infrastructure price, but OS updates, process supervision, TLS, deployment, monitoring and recovery become our responsibility. Conflicts with the stated wish not to manage a VPS. [Current official price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). |

Railway's proxy closes requests after five minutes without transferred data; even streaming requests top out at fifteen minutes. Convex progress updates do not send heartbeat bytes on that HTTP connection. Therefore a whole-ZIP request is not automatically portable. [Railway limits](https://docs.railway.com/networking/public-networking/specs-and-limits).

Modal function execution can be configured up to 24 hours. Its infrastructure may automatically retry interrupted inputs; existing file writes, job completion and deletion must tolerate that before enabling this execution model. This is a concrete platform behavior, not a reason to introduce a generic workflow framework. [Timeouts](https://modal.com/docs/guide/timeouts), [function execution and retries](https://frontend.modal.com/docs/guide/functions).

Cloudflare's current standard-3 shape provides 2 vCPU/8 GiB/16 GB disk. Custom shapes require at least 3 GiB RAM per vCPU, so a custom 2 vCPU shape needs at least 6 GiB. Disk is ephemeral by default; bake approved model weights into the image or arrange a suitable model cache. Verify sleep/keepalive behavior for jobs that continue after their HTTP request ends. [Instance limits](https://developers.cloudflare.com/containers/platform/limits/), [container lifecycle API](https://developers.cloudflare.com/containers/api/container-class/).

Convex's dedicated current limits page says 30 minutes for its native runtime actions and 10 minutes for Node actions; the general actions guide still says 10 minutes. Current dispatch uses the native runtime. Avoid building around the maximum of either: acknowledge long work promptly and use existing Convex job progress. [Limits](https://docs.convex.dev/production/state/limits), [actions guide](https://docs.convex.dev/functions/actions).

## Budget scenarios, not predictions

**Railway, warm small service:** assume average resident RAM 1.5 GB, average CPU 0.05 vCPU, and 50 GB outbound per month. Resource spend is `15 + 1 + 2.50 = $18.50/month`, or $20 on Pro due to its minimum. If average RAM is 3 GB, this becomes $33.50. A 4 GB ceiling is not the same as 4 GB billed continuously. A continuously consumed 2 vCPU plus 4 GB would be $80/month before networking. Rates above come from Railway's pricing page.

**Modal, sporadic batches/search:** assume 20 total billable container-hours at one physical core and 4 GiB: `20 × 3600 × (0.0000131 + 4 × 0.00000222) = $1.58` before credits. At 100 hours it is $7.91; at 720 hours, $56.97. Count model loading, warm retention, and all parallel containers. Region selection and non-preemptible execution can add multipliers. These numbers are not a promise that a particular number of photos takes 20 hours. Rates and credit treatment: [Modal pricing](https://modal.com/pricing).

**Cloudflare Containers, intermittent standard-3:** assume 20 running hours, average one active vCPU, 8 GiB and 16 GB disk. Gross container compute/storage is about $2.96 before included usage; with the documented monthly allowances and an otherwise unused Workers Paid plan, about $7.24 including the $5 plan, before Worker/DO/log overages. At 720 running hours, memory alone is $51.84 before its allowance. It is inexpensive when asleep, not necessarily the cheapest always-warm option. Formula uses the [published container rates and allowances](https://developers.cloudflare.com/containers/platform/pricing/).

Photo bytes uploaded from the processor to R2 count as that provider's outbound traffic. Downloads from R2 do not carry R2 egress charges, but requests and storage still matter. A 5,000-photo collection averaging 5 MB is roughly 25 GB; at standard R2 storage rates, keeping it 60 days is about $0.75 before free allowances, operations, temporary ZIP overlap and embeddings. This is only one part of event cost. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Migration sequence

1. Resolve commercial model rights and benchmark the actual production model. Record baseline cold start, warm search latency, peak RSS, CPU time, archive throughput and network bytes using a representative event; include a large archive and a crowded group photo.
2. Make the small service preparation changes: initialize the model once, use an approved immutable model artifact, avoid whole-ZIP RAM buffering, keep HTTP responsive during inference, and make readiness check model availability. Keep current authorization and R2/Convex boundaries.
3. Agree the execution boundary before adding machinery: a small adapter around existing Convex jobs and a managed long-running task, or a bounded worker on an always-running service. Do not add Redis, a new database, or a workflow framework just for this move. Validate restart/failure handling against the existing job states; a lost connection must not strand a collection permanently as running.
4. Run an isolated Railway versus Modal trial with test collections and scoped credentials. If consolidation wins over deployment simplicity, substitute a Cloudflare Containers trial. Keep provider counts low; no need to benchmark all seven candidates.
5. Compare a 5,000-photo ingest plus 100 searches, including search during ingestion. Set explicit acceptable cold/warm latency and upload completion targets before choosing. Test wrong-token rejection, result access, job failures and reprocessing. Calculate per-event cost including R2 retention, model licensing, payment fees and actual Convex operations.
6. After approval, deploy the chosen service and update only server-side Python URLs and secrets in Nuxt/Convex. Verify the organizer-to-attendee flow on a test event. Preserve the old revision and endpoint for rollback until the new service is proven.
7. Separately approve Google cleanup: inspect Cloud Run services/jobs, Artifact Registry images, Cloud Storage and any other billed resources; stop obsolete resources only after rollback no longer depends on them. Changing the endpoint alone does not stop registry charges.

## Evidence limits

The exposed MCP gateway inventory contained no Google Cloud, Railway or Cloudflare administrative tools for this investigation. A read-only `gcloud` check identified project `find-photos-of-me`, but listing Cloud Run services failed with `run.services.list` permission denied. No credential values were read or copied. There is no fresh live RAM/CPU, model-startup, traffic or bill measurement in this report. Provider capabilities/prices were checked against official pages; no provider account, payment, resource or deployment was created.

This file is the only repository change from this research task. The earlier launch/deployment notes were intentionally left intact; reconcile them once a hosting option is selected.

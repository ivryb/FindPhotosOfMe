# Modal / Cloudflare migration handoff

Status: Python migration deployed and verified. This thread owns `python/`, Modal
deployment, and the small Convex ingestion changes for background processing.
The parallel Cloudflare thread owns `apps/web/` and its deployment.

- Keep Convex `honorable-firefly-904` and the existing R2 bucket.
- Modal URL: `https://ivryb--findphotosofme-web.modal.run`.
  Deployed and verified with real face inference, R2 and Convex. Active Convex
  `PYTHON_API_URL` and `packages/backend/.env.local` now point here.
- Nuxt uses private `NUXT_PYTHON_API_URL` and `NUXT_SERVICE_TOKEN`.
- Convex uses `PYTHON_API_URL` and `SERVICE_TOKEN`.
- Python uses `SERVICE_TOKEN`. The same token must be used by all three.
- The token is now configured in active Convex and Modal. Read its value from
  ignored `python/.env` when configuring `NUXT_SERVICE_TOKEN`; do not regenerate it.
- `POST /api/process-ingest-job` accepts `{job_id, collection_id, file_key}`.
- `POST /api/search-photos` accepts multipart `search_request_id` and
  `reference_photo` and returns HTTP 200 after matching finishes. Both endpoints require `Authorization: Bearer <token>`.
- Ingestion returns HTTP 202 promptly; observe completion through Convex.
  Search preserves the existing synchronous HTTP contract for the parallel
  Convex Telegram handler: await HTTP 200, then read its completed Convex record.
- The parallel thread moved Telegram delivery into a Convex action. Python
  preserves its synchronous search-response contract; Telegram messaging remains
  outside the recognition worker.
- No frontend files will be edited by this thread.

Live smoke test: two photos indexed successfully; a reference photo found both.
Cold import acknowledgement 5.99 s, import completion 24.74 s; search
acknowledgement 2.43 s, completion 11.96 s in the initial asynchronous test.
Search was subsequently restored to synchronous HTTP completion for compatibility.
The deployed endpoint was verified returning HTTP 200 / "Search complete" for a
completed-search replay without changing that record. These are tiny-fixture timings,
not large-event throughput estimates. Source ZIP was deleted only after success.
The normal Convex dispatcher was also verified against the configured Modal URL:
it imported a second archive, preserving the first archive's photos. Subsequent
search found all three photos across both archives.

Coordination: the ingestion changes are deployed to Convex. The temporary internal
smoke helper has been removed and that removal deployed. All smoke-test records
and R2 objects were cleaned up. The Cloudflare thread can deploy its completed
Convex changes now. Preserve `ingestJobs:getForService` and the ingestion replay
guards added by this migration.

Validation: 9 Python behavior tests pass; Convex code generation/typechecking and
deployment pass. Modal reports zero runners and zero running inputs for web,
ingest and search after the idle windows, confirming scale-to-zero.

## Google Cloud cleanup completed

On 3 October 2026, after Ivan confirmed the Cloudflare migration and authorized
removal, the following were deleted from `find-photos-of-me` (`624207591311`):

- Cloud Run service `find-photos-of-me` in `europe-west1` and its revisions.
- Cloud Build deployment trigger `72a0eea3-0560-49a5-bedc-c27fd4793635`.
- Artifact Registry repository `cloud-run-source-deploy` in `europe-west1`,
  including approximately 1.96 GB (1.83 GiB) of old Python/Telegram images.
- GCS bucket `python-insightface-models` and its seven model-cache objects
  (629,890,080 bytes). Soft delete was disabled before removal; there were no
  pre-existing soft-deleted objects.
- Four unused `container-analysis-*` Pub/Sub topics.

Final listings confirmed no active Cloud Run services, Artifact Registry
repositories, storage buckets, build triggers or Pub/Sub topics remain. Modal's
health endpoint returned HTTP 200. Google still lists the deleted model bucket
as soft-deleted, with a hard-delete time of 10 October 2026 at 02:24 UTC, despite
its updated zero-retention policy. Do not assume immediate permanent removal or
zero residual storage charges during that retention window.

No Cloud Run jobs, VMs, persistent disks, reserved IP addresses, forwarding rules,
BigQuery datasets, Pub/Sub subscriptions, active Cloud Build jobs, or regional
Cloud Build connections were found in the inspected inventory.

**Keep the Google project and its OAuth client.** The active Convex
`GOOGLE_CLIENT_ID` belongs to project `624207591311`; deleting the project would
break Google sign-in. OAuth configuration, R2 photos, Convex data, Modal and
Cloudflare were preserved. Old Cloud Run rollback infrastructure no longer exists.

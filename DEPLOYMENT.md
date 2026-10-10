# Deployment

How the live app is laid out, how to ship it, and how to look at it. Release history lives in the git log.

## What runs where

- **Worker** `findphotosofme` serves the Nuxt app: landing pages, dashboard, API routes, Telegram webhooks, and photos
  under `/media`, read from R2 through the `PHOTOS` binding and kept in the edge cache. Canonical origin
  `https://findphotosofme.com`; direct subdomains are galleries. Fallback URL
  `https://findphotosofme.ivrybn.workers.dev`. The account is on Workers Paid, which every photo view counts against.
- **Convex** production deployment `merry-firefly-921` holds auth, data, upload coordination, and Telegram searches.
  Email OTP delivery is not configured on it. The development deployment `honorable-firefly-904` is for local work only:
  it has a copy of production's data from 10 October 2026, Creem test mode, and `PYTHON_API_URL` pointing at
  `localhost:8000`. It still shares the R2 bucket with production.
- **Modal** app `findphotosofme` in workspace `ivryb` runs face processing and search; see
  [python/README.md](python/README.md).
- **R2** stores photos, their thumbnail and 2048px screen versions, and face indexes. A lifecycle rule deletes staged
  `uploads/` objects after 7 days. CORS allows the root, www, `*.findphotosofme.com`, localhost, and the Worker
  fallback.
- **DNS** is Cloudflare zone `087e5025719045bfa3e3c8c418b1378a`; the Spaceship registration delegates to
  `lewis.ns.cloudflare.com` and `lorna.ns.cloudflare.com`. Apex, wildcard, and www records are proxied placeholders, and
  the Worker answers every request.
- The Google Cloud project stays only for the Google sign-in OAuth client. Keep it, and leave Cloud Run retired.

## Deploying

Every push to `main` deploys production. GitHub Actions ([ci.yml](.github/workflows/ci.yml)) runs the type checks and
tests, then `bun run deploy`, which publishes Convex functions to `merry-firefly-921` (`convex deploy`), then Modal,
then the Worker. Convex goes first because Modal workers and the Worker call its new functions. It stops at the first
failure, and a newer push waits for a running deploy to finish. Pull requests only run the checks.

The deploy step uses four repository secrets: `CONVEX_DEPLOY_KEY` (production deploy key `github-actions`),
`MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (Ivan's Modal token), and `CLOUDFLARE_API_TOKEN` (account token
"FindPhotosOfMe GitHub Actions deploy", limited to Workers scripts and the zone's routes).

To deploy by hand, run the same command from a clean worktree of the release commit; each part also deploys alone:

```bash
bun run deploy                                # everything, in order
bun --filter @FindPhotosOfMe/backend deploy   # Convex
bun run deploy:modal                          # Modal (needs `modal setup` once)
bun --filter web deploy                       # Cloudflare Worker
(cd apps/web && bunx wrangler deploy --dry-run)   # check the Worker build without publishing
```

Modal's rolling deploy lets running batches finish on the old workers.

Nitro generates `apps/web/.output/server/wrangler.json` and the Wrangler redirect under `.wrangler/deploy/`. Build before running Wrangler. The checked-in `apps/web/wrangler.jsonc` owns the Worker name, routes, and compatibility settings; Nitro supplies the entry point and static assets. This uses Nitro 2's [Workers adapter](https://v2.nitro.build/deploy/providers/cloudflare).

Set the variables listed in `apps/web/.env.example` as Worker secrets using `wrangler secret put NAME` from `apps/web`. Keep service and storage credentials out of the build environment; Nuxt resolves them from bindings during requests. The Convex module's URL has an empty-string default so its runtime configuration key survives builds without a local `.env`; the existing `NUXT_PUBLIC_CONVEX_URL` binding supplies both the module and server clients. For a local production preview, copy the runtime values into the gitignored `apps/web/.dev.vars`. Public Convex configuration must point at the same deployment as the server credentials.

Telegram uses Convex's existing scheduler because Workers background execution is [limited to 30 seconds after a response](https://developers.cloudflare.com/workers/platform/limits/#duration). Configure `PYTHON_API_URL`, `SERVICE_TOKEN`, and the four `R2_*` values in `packages/backend/.env.example` on the Convex deployment. `TELEGRAM_WEBHOOK_BASE_URL` points bots at the Worker fallback URL, so webhooks don't depend on custom-domain DNS. Node actions have a [10-minute execution limit](https://docs.convex.dev/production/state/limits#execution-time-and-scheduling); Python requests time out at eight minutes to leave room for error reporting. Failed actions are not automatically retried; users can resend their selfie.

## Looking at production

Run Convex commands from `packages/backend` with `--prod`; without it, the CLI uses the development deployment from
`.env.local`.

```bash
bunx convex logs --prod --history 500                          # recent function logs
bunx convex data searchRequests --prod --order desc --limit 5  # any table, newest first
bunx convex env get NAME --prod                                # deployment settings
(cd apps/web && bunx wrangler tail findphotosofme)      # live Worker logs
```

A failed Telegram search logs its `requestId` and the `stage` that failed (`download`, `search`, or `delivery`); the
search request's `status` and `error` record what the search service concluded. Modal logs are on its deployment page,
linked from [python/README.md](python/README.md).

## Maintenance

One-off jobs are Python scripts in `python/maintenance/` and Convex functions run with `bunx convex run`, such as
`collections:moveTelegramBot` and `uploads:removeUpload`. The screen-version backfill has run only for IT Arena 2026;
elsewhere the viewer and the Telegram bot fall back to originals.

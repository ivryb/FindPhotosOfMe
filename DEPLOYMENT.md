# Deployment Configuration

## Nuxt on Cloudflare Workers

The landing page, dashboard, API routes and Telegram webhook share the `findphotosofme` Worker. Convex retains authentication, data, ingestion coordination and Telegram search continuations; R2 retains photos. Python hosting is a separate Modal migration.

From the repository root:

```bash
bun install --frozen-lockfile
bun --filter web build
(cd apps/web && bunx wrangler deploy --dry-run)
bun --filter web preview
# Publishes to Cloudflare:
bun --filter web run deploy
```

Nitro generates `apps/web/.output/server/wrangler.json` and the Wrangler redirect under `.wrangler/deploy/`. Build before running Wrangler. The checked-in `apps/web/wrangler.jsonc` owns the Worker name and compatibility settings; Nitro supplies the entry point and static assets. This uses Nitro 2's [Workers adapter](https://v2.nitro.build/deploy/providers/cloudflare).

Set the variables listed in `apps/web/.env.example` as Worker secrets using `wrangler secret put NAME` from `apps/web`. Keep secrets out of the build environment; Nuxt resolves them from bindings during requests. For a local production preview, copy those values into the gitignored `apps/web/.dev.vars`. Public Convex configuration must point at the same deployment as the server credentials. `NUXT_PUBLIC_ORIGIN` is the canonical root origin (`https://findphotosofme.com` in production); only direct subdomains of this host are treated as event slugs.

Telegram uses Convex's existing scheduler because Workers background execution is [limited to 30 seconds after a response](https://developers.cloudflare.com/workers/platform/limits/#duration). Configure `PYTHON_API_URL`, `SERVICE_TOKEN`, and the four `R2_*` values in `packages/backend/.env.example` on the matching Convex deployment. Node actions have a [10-minute execution limit](https://docs.convex.dev/production/state/limits#execution-time-and-scheduling); Python requests time out at eight minutes to leave room for error reporting. Failed actions are not automatically retried; users can resend their selfie.

### Deployed configuration (3 October 2026)

- Worker: `findphotosofme`, with fallback URL `https://findphotosofme.ivrybn.workers.dev`.
- Canonical origin: `https://findphotosofme.com`; root and wildcard event routes are managed in `apps/web/wrangler.jsonc`.
- Cloudflare zone: `087e5025719045bfa3e3c8c418b1378a`. Spaceship delegates to `lewis.ns.cloudflare.com` and `lorna.ns.cloudflare.com`; the registry confirms this change and Cloudflare reports the zone active.
- Proxied apex, wildcard and www DNS records use reserved placeholder addresses; the Worker serves the entire request. Existing CAA records are preserved. The old DNS zone had no mail records.
- Convex remains `honorable-firefly-904` (the existing development deployment), as requested. `SITE_URL` is the canonical origin. Additional trusted origins cover localhost, the Worker fallback and HTTPS event subdomains.
- R2 CORS includes the canonical root, www, localhost and the Worker fallback.
- `TELEGRAM_WEBHOOK_BASE_URL=https://findphotosofme.ivrybn.workers.dev/api/telegram`. Existing bot registration uses this stable endpoint with a webhook secret, independently of custom-domain DNS propagation. Search and photo delivery run in Convex.
- Worker Python URL and service token match the deployed Modal service below.
- The FindPhotosOfMe project was already absent from the authenticated Vercel team; there was no project to delete. Domain registration and renewal remain with Spaceship.

Build, type checks, Worker runtime configuration, real R2 preview streaming, Google sign-in initiation, auth CORS, and signed/no-secret Telegram webhook responses were verified. Root, www and event routes serve HTTPS successfully when resolved to Cloudflare. At cutover, some public DNS caches still resolved the apex to the previous Vercel addresses; the event hostname already resolved to Cloudflare.

This hosting verification does not replace the launch acceptance test: complete Google sign-in, signed-in upload/search/download and a real Telegram selfie-to-results journey still need verification. Email OTP delivery credentials are not configured on the shared Convex deployment. See [the migration handoff](docs/cloudflare-handoff.md) for verification details.

### Deployed update (4 October 2026)

Published frontend commit `d7fa05c` to Cloudflare Worker version
`c20df923-0106-456f-8ce0-53c7b118e0f1`. This includes the current landing pages,
pricing calculator, and authenticated admin SSR. Convex and Modal deployments
are unchanged.

Auth now uses same-origin HttpOnly cookies. Existing browser sessions stored in
localStorage require signing in again. Google retains the existing Convex OAuth
callback; the app finishes the cookie handoff at `/auth/callback`.

The production build, Wrangler dry run, and nine isolated auth/admin HTTP tests
passed. Both admin pages received live updates in browser fixture checks. After
deployment, the root and three audience pages and sign-in returned HTTP 200;
anonymous admin pages redirected to sign-in, the admin API returned 401, and
Google sign-in initiation returned its provider URL with a Secure, HttpOnly
callback cookie. Private responses carry `private, no-store`.

A complete Google sign-in on production has not been reverified for this release.
Typechecking remains blocked by the existing Nuxt `DefineNuxtConfig` typing issue
and reports the existing Volar `vue-router` plugin resolution warning.

### Event previews and public attendee search (4 October 2026)

Worker version `a49d9533-57c4-4599-9246-5d3740f27472` includes fixes `2c89a86`
and `28abfba`. The Cloudflare bundle now resolves browser runtime mappings
consistently, fixing the S3 initialization crash that broke event previews. The
shared `honorable-firefly-904` deployment also accepts anonymous attendee
searches. Organizer permissions and existing private searches remain protected;
result downloads only authorize photos matched by the specified search.

Verified all ten IT Arena previews in production, then uploaded a preview image
through the signed-out browser flow, completed a search, and loaded its matched
photo. The local Worker also returned 404 for a non-preview image. Eleven HTTP
integration tests, the production build, and frontend/backend typechecks passed.
The Nuxt configuration typing error is resolved; the existing Volar plugin
resolution warning still appears without failing typechecking.

### Logo and favicons (4 October 2026)

Worker version `8d23f841-f12b-41ba-aa51-67a9c0c34c98` publishes `a1dc474`: the
aperture favicons, Apple touch icon, and web manifest. Production serves the head
tags and all seven icon files byte-identical to the repository. Convex and Modal
are unchanged.

## Python ML Service on Modal

The Python backend is deployed as `findphotosofme` in Modal workspace `ivryb`:

- Endpoint: `https://ivryb--findphotosofme-web.modal.run`
- Convex `PYTHON_API_URL` points to this endpoint.
- Set the frontend's private `NUXT_PYTHON_API_URL` to the same URL and use the
  matching `NUXT_SERVICE_TOKEN` (available in ignored `python/.env`).
- Ingestion returns HTTP 202 and continues in a Modal job; search returns HTTP
  200 after matching finishes, matching the Convex Telegram handler's contract.
- CPU workers scale to zero. Models are baked into the image; photos and indexes
  remain in R2 and application state remains in Convex.

Deployment, limits, secrets and local testing are documented in
[python/README.md](python/README.md). Verified migration status and the parallel
frontend handoff are in [docs/modal-handoff.md](docs/modal-handoff.md).

The old Cloud Run service, Artifact Registry images, build trigger and Google
model-cache bucket were deleted on 3 October 2026. The Google project remains
solely to preserve its active Google sign-in OAuth client. Do not delete that
project or redeploy Cloud Run. See the cleanup inventory in the handoff above.

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

Set the variables listed in `apps/web/.env.example` as Worker secrets using `wrangler secret put NAME` from `apps/web`. Keep service and storage credentials out of the build environment; Nuxt resolves them from bindings during requests. The Convex module's URL has an empty-string default so its runtime configuration key survives builds without a local `.env`; the existing `NUXT_PUBLIC_CONVEX_URL` binding supplies both the module and server clients. For a local production preview, copy the runtime values into the gitignored `apps/web/.dev.vars`. Public Convex configuration must point at the same deployment as the server credentials. `NUXT_PUBLIC_ORIGIN` is the canonical root origin (`https://findphotosofme.com` in production); only direct subdomains of this host are treated as event slugs.

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

### Galleries, balance, and parallel uploads (4 October 2026)

Released `20985b3` through `a579a4f` plus the production fixes committed with this note: the gallery page,
the dashboard, the shared balance (payments held until Lemon Squeezy verifies the store), and browser uploads
processed in parallel batches. Worker version `f9682b04-4bfb-4845-a5a0-375f88467c89`; Modal app redeployed;
Convex `honorable-firefly-904` (also the local `convex dev` target, so it took each change as it was saved).

Rollout on production: `migrations:moveToBalance` moved the three Lemon Squeezy test galleries;
`balances:grant` gave ivrybn@gmail.com $100; `convert_face_indexes` turned IT Arena's 160 MB
`embeddings.json` into an 11 MB `faces/index.npz` (10,764 faces), with the original kept at
`backups/jd7295ata4ws4510q3g8zzgkpd7s6498-embeddings-2026-10-04.json.bak`; `backfill_thumbnails` was started for
IT Arena's 2,742 photos; an R2 lifecycle rule now deletes `uploads/` objects after 7 days. CORS already allowed
photo uploads.

Verified on production: IT Arena browses page by page with signed thumbnails and finds a cropped selfie
("2 photos of you"); a test gallery acting as the admin took 120 IT Arena photos copied into its upload area,
registered in three batches. Three workers kept all 120 within about 2.5 minutes, the batches merged into one
index, the upload area emptied, the balance moved by exactly 120 photos and one search, and the gallery's public
page found the selfie. A browser on findphotosofme.com put a photo into R2 with a signed link. The test gallery
was deleted afterwards. Not verified: the dashboard upload screen signed in on production (it was run end to
end against the test backend), Google sign-in, and Telegram.

Fixed during the release: R2 listings failed on Workers because the SDK's browser XML parser needs `DOMParser`
(the build now uses its plain-JavaScript parser); the Modal web endpoint crashed because it imported numpy, which
its image lacks, taking search and uploads down for about 15 minutes; and the thumbnail backfill stopped at the
index backup, which it now skips as a non-photo.

### Photos through the edge cache (4 October 2026)

Worker version `7e4ed51e-3f36-462b-aa68-585ed5db17e8` serves photos from `/media` with signed links, reading R2
through the `PHOTOS` binding and keeping copies in the edge cache; Modal now writes WebP thumbnails. The account is
on Workers Paid, which every photo view now counts against. Measured from Hong Kong against the EEUR bucket: cached
views were as fast as a request the Worker answers without any work (about 0.15–0.25 s after connecting), and first
views added about 0.6 s, mostly distance to the bucket. Forged links get 403, and downloads come as attachments.

### Private galleries and mobile dashboard (5 October 2026)

Worker version `92b7273b-04db-4f91-a86d-06fa97712d6b` publishes application commit `bbdaf40`,
including private-by-default galleries, owner search, publication controls, separate upload and search
sections, mobile list/detail navigation, daily storage billing, authentication fixes, and the landing-page
refresh. Convex functions and schema were deployed to the existing `honorable-firefly-904` deployment using
`convex dev --once`; R2 and the unchanged Modal service remain in place. Existing galleries retain public access.

Validation: 31 backend tests and 25 web tests passed, as did workspace type checks, the production build,
and the Worker deployment dry run. Production home, audience pages, and sign-in return 200; signed-out
dashboard requests redirect to sign-in and its API returns 401. IT Arena still serves its public page and
all 2,742 photo keys, with thumbnails loading in the browser. Mobile home, sign-in, and IT Arena pages
have no horizontal overflow. Dashboard interactions were checked against the local test backend;
Google sign-in, uploads, paid checkout, and selfie matching were not repeated on production in this release.

The local continuous `convex dev` watcher remains paused because it targets the live deployment;
this release used an explicit one-shot deployment.

### HTTPS, mobile menu, and stable media URLs (5 October 2026)

Worker version `1cccb24f-c68d-489d-a557-0dc58790f7b8` publishes application commits `4477680`, `5f97644`, and `ed796d6`: the landing-page hamburger menu, HTTP-to-HTTPS redirects for the canonical host and its event subdomains, and stable media URLs checked against gallery publication, owner identity, or search-result access. Media signing and its expiry have been removed. See [gallery publication](docs/gallery-publication.md) for the access and cache behavior.

Convex functions were deployed first to the existing `honorable-firefly-904` deployment using `convex dev --once`, followed by the Worker. The R2 bucket, Modal service, and service secrets are unchanged. Old signed public preview URLs continue to work according to the current public gallery policy; their signature query parameters are no longer used. Previously issued private search URLs must be replaced with the new request-aware URLs.

Local verification passed: 34 web HTTP/unit tests, 36 backend tests, type checks, the production build, and a Worker deployment dry run. Browser checks covered the branded mobile menu and stable gallery thumbnails/full photos. A production-built local Worker with isolated R2 data proved that warmed cache entries and conditional requests are denied after unpublishing, while the owner retains access. The review's private-gallery token rate-limit issue was fixed and covered by a regression test.

Production verification: root, www, and event HTTP links return 308 to HTTPS with paths and queries preserved. Landing/audience/sign-in pages return 200; the signed-out dashboard redirects to sign-in and its API returns 401. The mobile menu opens and closes after navigation, with no horizontal overflow. IT Arena lists all 2,742 photo keys without signatures; its thumbnails, originals, downloads, and an existing signed public URL return 200, and ETag revalidation returns 304 with no body. Stored indexes, invalid galleries, and invalid search-result access return 403. Google sign-in, private owner sessions, uploads, selfie matching, and checkout were not repeated on production for this release.

### Fullscreen photo sizing (5 October 2026)

Worker version `b1555d7c-113e-4798-acc3-bac1f1a416fd` publishes application commit
`e12f769`. The shared fullscreen viewer bounds its grid tracks to the available
space, keeping large photos fully visible without changing their aspect ratio.
The release was built from a clean checkout of that commit.

The production build and Wrangler dry run passed. Local browser checks covered
20 photo and viewport combinations, navigation, and closing. The deployed CSS
matches the release build byte for byte; the home and IT Arena pages return 200.
IT Arena photo 1,263, which reproduced the reported crop before deployment, now
fits completely at desktop, mobile portrait, and mobile landscape sizes.

### Session recovery and gallery list alignment (5 October 2026)

Worker version `b14a9de6-de14-4699-b945-25a41f8f5d68` publishes `a068d61` and
`7753695`. The Your galleries heading now uses the shared dashboard padding.
Authentication redirects only after a confirmed missing session or a 401 from
the session check. Temporary session and token failures retain the dashboard,
show a connection notice, and retry session verification and Convex connection
every five seconds. Thrown network errors from token requests also enter this
recovery path. Convex, R2, Modal, session settings, and service secrets are unchanged.

Validation passed: 37 web tests, 36 backend tests, workspace type checks, the
production build, Wrangler dry run, and implementation review. The new network
regression test fails against the previous token fetcher and passes with the fix.
Browser fixtures verified homepage → Try during an initial session-check 503,
automatic recovery with the same login, scheduled token renewal during sustained
503 responses, and live updates after reconnecting. Confirmed expired sessions
and explicit sign-out still redirect and remove private dashboard content.

Production home and sign-in return 200; anonymous session checks return 200 with
no session, the token and dashboard APIs return 401, and the dashboard redirects
to sign-in. The deployed auth JS and dashboard CSS match the release build byte
for byte, and the signed-out homepage → Try flow works in the browser. Signed-in
recovery was verified with isolated fixtures. Complete Google sign-in and
signed-in recovery were not repeated against production for this release.

### Link preview images (6 October 2026)

Worker version `d1606642-2506-46c8-bd83-284acae6f1bd` publishes `1c0e2bf`. Every
page sets `og:image`, its size, `og:title` from the page title, and a large
Twitter card. Site pages share `/og.png`. Public galleries with previews point to
`/og/<subdomain>`, a 1200×630 JPEG drawn by Takumi's WebAssembly build from the
gallery's name, photo count, and first five preview thumbnails, and cached at the
edge under a key built from what it shows. The Worker grows from 536 KiB to
2.36 MiB gzipped (the WebAssembly module is 1.63 MiB) and starts in 19 ms. Convex,
R2, Modal, and secrets are unchanged.

Validation passed: 37 web tests, the web type check, the production build, and
the Wrangler dry run. Under local workerd the route rendered IT Arena from the R2
binding and later requests hit the edge cache. Short, one-letter, long, very long,
single-word, Cyrillic, and emoji titles rendered in 40–60 ms each once warm.

Production serves `/og.png` and IT Arena's `/og/itarena` (byte-identical to the
local render); unknown galleries return 404 and public thumbnails still load.
Root, audience, and gallery pages carry the expected tags. A few requests during
rollout returned 404 from the previous version. Cached gallery images take about
as long as the Convex availability check (0.35–1 s from Singapore). Each new
render needs more than the free plan's 10 ms of CPU; the Workers plan was not
confirmed.

### Crowdsourced galleries and secret links (6 October 2026)

Merged and pushed `5b4e07b`, followed by `84ec404` for long event titles on narrow
screens and `11fe8c3` for runtime-only Convex configuration. Deployed Modal first, then Convex to the existing `honorable-firefly-904`
deployment using `convex dev --once`, and the Worker. Final Worker version:
`d3cc3a9d-e289-447c-a3cf-c904dfd237d3`. The continuous Convex watcher remains
paused. Existing galleries and storage required no migration.

R2 CORS now includes `https://*.findphotosofme.com`, preserving all existing
origins, methods, and headers. Guest uploads reserve credit for exact files and
sizes before issuing direct storage URLs; verified completion converts the hold
into a charge. Expired abandoned uploads and rejected photos use the existing
recovery job for storage cleanup and credit release.

Validation passed: 66 backend, 41 web, and 21 Python tests, workspace type checks,
the production build, and a Wrangler dry run. A temporary live gallery exercised
owner/other-account access, secret-token enforcement, real signed uploads from
both supported origins, retries without duplicate charges, processing photos
with and without faces, corrupt-photo isolation, original downloads, and face search. Root
and sign-in return 200, anonymous admin redirects and its API returns 401, and
IT Arena still loads its existing photos. Live mobile sheets and both actions
work at 390 pixels; the long-title fix was verified after deployment at 320 pixels.
See [the review evidence](docs/review/crowdsource/README.md).

The timed live check confirmed automatic release of the abandoned reservation,
refund of the rejected photo, and rejection of the expired storage URL. Final
test cost was 25 mills ($0.025): two retained photos and one attendee search.
R2 staging was physically empty before final cleanup. The temporary gallery,
its processed files, uploads, batches, and search requests were removed; both
storage prefixes were verified empty. [Sanitized results](docs/review/crowdsource/live-verification.json)
record the checks and deployed versions.

The first Worker build omitted the public Convex URL in the isolated worktree,
causing SSR errors during the initial rollout. Rebuilding with
`NUXT_PUBLIC_CONVEX_URL` restored the pages within about two minutes. The subsequent
configuration fix preserves the key even without a build-time value, allowing
the existing runtime binding to supply it. A clean build without the URL passed
local Worker checks using runtime bindings alone, then served the home, sign-in,
and IT Arena pages successfully after deployment. Service credentials were retained as
Worker secrets. Already-open upload pages using the former API need
a refresh. Fresh Google sign-in, live Telegram delivery, and checkout were not
repeated for this release.

### Lower prices and a still selfie while searching (8 October 2026)

Prices dropped to $2 per 1,000 photos, $1 per 100 searches, and $0.05/GB for each 30 days of storage past the
included 30, aiming at about 50% margin after infrastructure and payment fees. The free trial grows to 1,000
photos and 50 searches; the $10 minimum payment is unchanged. Existing balances are stored as money, so they
simply cover more. Pages read their price copy from the backend rates. The selfie search no longer spins the
avatar ring; the progress bar alone shows a search is running.

Convex functions went to `honorable-firefly-904` with `convex dev --once`, then Worker version
`70f6cd63-a90c-4870-95ab-ffbc6c92634f` (the ring change alone had shipped earlier as `ab64a186`). Both were
deployed from a clean worktree, leaving unrelated uncommitted guest-upload work out. Backend tests (66), type
checks, and the production build passed. Production home, personal, photographers, and organizers pages show
the new rates, trial, and minimum. A real charge at the new rates was not exercised on production.

### Guest photo moderation and upload status (8 October 2026)

Pushed `f75a987`. Convex went to `honorable-firefly-904` with `convex dev --once`, then Modal (its image now
includes `openai==3.22.1`), then Worker version `01712f99-cf28-4b75-8524-2adfffae0ddb`, which also ships `1c1b9d8`:
guest uploads finish once their photos reach storage. `OPENAI_API_KEY` was added to the Modal secret
`findphotosofme-backend` with the SDK's `modal.Secret.update`, which keeps the other keys; the CLI can only replace a
whole secret.

Backend tests (66), web tests (41), Python tests (17; the thumbnail test skips without Pillow), type checks, and the
production build passed. A one-off function on the production image and secret called the moderation endpoint and
allowed a plain landscape. Production home, sign-in, and organizers pages return 200. A real guest upload through
moderation was not exercised on production, and no explicit image was sent.

### Guest sheets lead with their status (8 October 2026)

Pushed `160187b` and `d7e538e`, then published Worker version `3a914276-15a4-47b7-91c2-220820fb3f67` from a clean
worktree. Once a guest has chosen photos, the upload sheet leads with their uploads and offers **Add more photos**
below them; the searching selfie sheet drops its **Keep browsing** link and fits its content on phones. Convex and
Modal are unchanged. [Recordings of every sheet state](docs/review/crowdsource/README.md#sheet-state-recordings) were
made against the fixture app.

Web tests (41), the web type check, the production build, and the Wrangler dry run passed. Production home, sign-in,
and organizers pages return 200, IT Arena redirects to its search page as before, and the deployed sheet bundle is
byte-identical to the release build. A guest upload and search on a live crowdsourced gallery were not repeated.

## Python ML Service on Modal

The Python backend is deployed as `findphotosofme` in Modal workspace `ivryb`:

- Endpoint: `https://ivryb--findphotosofme-web.modal.run`
- Convex `PYTHON_API_URL` points to this endpoint.
- Set the frontend's private `NUXT_PYTHON_API_URL` to the same URL and use the
  matching `NUXT_SERVICE_TOKEN` (available in ignored `python/.env`).
- Batch processing and merges return HTTP 202 and continue in Modal jobs; search returns HTTP
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

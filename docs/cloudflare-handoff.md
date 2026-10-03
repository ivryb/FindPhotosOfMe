# Cloudflare migration handoff

Deployed 3 October 2026. The Nuxt app, dashboard/API and Telegram webhook run in
Worker `findphotosofme`. The future landing page can live in the same Nuxt app.
No new landing-page design was added by this migration.

## Live configuration

- Canonical origin: https://findphotosofme.com
- Event routing: https://itarena.findphotosofme.com/search and wildcard event hosts.
- Fallback: https://findphotosofme.ivrybn.workers.dev
- Cloudflare account: `8a66125b4def6052f9afa0b466b8c04a`.
- Zone: `087e5025719045bfa3e3c8c418b1378a`, active.
- Spaceship nameservers: `lewis.ns.cloudflare.com`, `lorna.ns.cloudflare.com`.
  Verified saved at the registrar and in Verisign RDAP. Some apex DNS caches
  still returned Vercel at the final check; event DNS already returned Cloudflare.
- Apex, wildcard and www A records are proxied reserved placeholders. Both
  Worker route patterns are checked into `apps/web/wrangler.jsonc`.
  CAA records were preserved; the old zone had no MX/TXT mail records.
  The imported `_domainconnect` CNAME remains unused; it does not serve the app.
- Existing Convex development deployment `honorable-firefly-904` is retained,
  as requested. Production Convex was not initialized.
- Worker private Python URL is `https://ivryb--findphotosofme-web.modal.run`.
  Its service token matches Modal and Convex, using the separate Modal handoff.
- Telegram webhook base is the stable Worker URL plus `/api/telegram`, with
  the existing IT Arena bot re-registered and its pending update count checked
  at zero. Registration includes a derived secret. Search and result delivery
  run in the existing Convex scheduler, outside the webhook request lifetime.
- Auth trusts the canonical origin, HTTPS event subdomains, Worker fallback
  and existing localhost development origin. R2 CORS includes the fallback.
- The FindPhotosOfMe Vercel project was already absent from the authenticated
  team. No project remained to delete. Spaceship registration/renewal is intact.

## Verification

- Nuxt build, frontend/backend type checks, Convex deployment, Wrangler dry run
  and real Worker deployment passed. Frozen lockfile validation and diff checks passed.
- Worker root/sign-in return 200; unauthenticated photo authorization returns 401;
  a Telegram webhook without its secret returns 403; a signed no-op update returns 200.
- A real public R2 preview returns a 791,345-byte JPEG from the Worker. The AWS
  SDK explicitly uses its Fetch handler because the default Node HTTPS transport
  failed in the real Worker runtime.
- Root, www and event search return 200 with valid TLS when resolved to Cloudflare.
  Arc renders the live IT Arena collection, its 2,742-photo count and preview images.
- Google sign-in initiation reaches the Google authorization URL. Auth CORS
  allows the Worker and HTTPS event origins, and rejects HTTP event/untrusted origins.
- Local action behavior checks covered 11-photo delivery as 10+1, no matches,
  Python failure and a delivery failure after search completion, using mocked
  Telegram/network boundaries. No test messages were sent to real users.
- A real Telegram photo exposed a MIME mismatch after cutover: Telegram downloads
  JPEG photos as `application/octet-stream`, which the Python upload boundary
  rejects. The Convex action now labels its JPEG upload `image/jpeg`. Replaying
  the failed request through the corrected action and live Modal/R2 found three
  matches, and all three signed URLs were readable. Telegram sends were intercepted
  during this verification; actual chat delivery still requires a user retry.
- Actual private credential values were absent from built public/server bundles.

## Remaining launch validation

Complete Google sign-in, authenticated ZIP upload/search/download and a real
Telegram selfie-to-results journey still need acceptance testing. Email OTP
sender credentials (`CLOUDFLARE_EMAIL_API_TOKEN`, `AUTH_EMAIL_FROM`) are absent
from the shared Convex environment. This migration does not certify the full
new-user launch journey or configure email/billing for launch.

The separate [Modal handoff](modal-handoff.md) records its real inference and
storage tests. Google Cloud resources remain for separately approved cleanup.
No git commit or push was made; pre-existing launch work and the parallel
Python changes remain in the working tree.

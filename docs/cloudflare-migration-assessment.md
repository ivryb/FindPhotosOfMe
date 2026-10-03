# Cloudflare migration assessment

Historical pre-implementation assessment. The migration has since been deployed; current status and remaining validation are in [cloudflare-handoff.md](cloudflare-handoff.md) and [DEPLOYMENT.md](../DEPLOYMENT.md).

Research date: 2 October 2026. Scope: Nuxt dashboard, public website, API routes and Telegram webhook. Convex and existing R2 storage stay in place. This assessment uses the current working tree, including uncommitted authentication, billing and upload changes. It does not assert that these changes are deployed.

## Recommendation

Cloudflare Workers with Static Assets is a credible replacement for Vercel for this app. Keep the Nuxt application together, keep Convex as the database/authentication/job coordinator, and keep large uploads going directly to R2. The landing page does not need to wait for this migration.

This is not a configuration-only move. The Telegram handler depends on Vercel background execution, and its search-and-reply lifecycle must change before moving it safely. Start with a local Workers build and preview, then a separately approved staging deployment. Do not combine the hosting move, Python move and dashboard redesign into one release.

Budget approximately **$5/month for Workers Paid**, plus existing R2, Convex and the separately chosen Python host. Free Workers may suffice for a static landing page; do not promise that the complete Nuxt app fits its CPU allowance before measuring it. Account-wide allowances may already be consumed by other projects. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Evidence and remaining uncertainty

Verified locally:

- The lockfile resolves Nuxt 4.1.2, Nitro 2.12.6 and Wrangler 4.42.0. The repository already declares Wrangler but has no checked-in Wrangler configuration.
- `apps/web/nuxt.config.ts` has no explicit deployment preset and uses `compatibilityDate: "latest"`.
- The dashboard obtains a signed URL and uploads ZIP files straight to R2. Convex schedules an internal action to dispatch ingestion to Python.
- Better Auth and the Lemon Squeezy webhook run in Convex, not the Nuxt server.
- The Telegram photo handler imports `waitUntil` from `@vercel/functions` and opens a Convex subscription from its background continuation.

Verified against current primary documentation: Nitro supports Workers; Cloudflare documents Nuxt deployment and current limits/prices; grammY supports a native Workers webhook adapter.

Not verified: the actual Cloudflare account/plan, domain zone and DNS records, production R2 CORS settings, Vercel deployment settings/usage/bills, currently deployed source, real search latency, bundle size or Workers runtime behavior. No Cloudflare-specific tools were exposed in this session's enabled tool catalog, although the MCP gateway itself was present. No deployment, DNS edit, webhook registration, billing change or production data mutation was performed. No build was run during this research-only assessment.

## Component fit

| Component | Current implementation | Cloudflare assessment |
| --- | --- | --- |
| Landing page and assets | Nuxt/Vue | Good fit; prerender marketing content and serve assets directly. |
| Dashboard and search UI | Nuxt, `convex-nuxt`, `convex-vue` | Likely portable; verify SSR and client authentication in the actual Workers build. |
| App API | Nitro/H3 handlers, fetch, Convex HTTP client | Likely portable with the Nitro Workers adapter. |
| Authentication | Better Auth component and HTTP routes in Convex | Keep it there; preserve origins, tokens and Google callback configuration. |
| ZIP upload | Signed S3 PUT URL; browser uploads directly to R2 | Keep this flow; check CORS for staging and production domains. |
| Ingestion dispatch | Convex scheduler → Python | Hosting the dashboard elsewhere does not require rewriting this flow. |
| Selfie search | Nuxt multipart handler → synchronous Python request | Test buffering, memory, cold starts and client disconnect behavior. |
| Photo delivery | R2 SDK, Node stream proxy for public previews, signed private URLs | Validate SDK/stream compatibility; native R2 binding is a small fallback if needed. |
| Telegram bot | Node HTTP adapter plus Vercel background work | Requires adapter and execution-lifecycle changes. |
| Payments | Convex `/api/lemonsqueezy/webhook` | Endpoint can remain unchanged; app checkout return URLs need verification. |
| Face recognition | Separate Python service | Not part of a JavaScript Worker migration. |

Local evidence: [Nuxt config](../apps/web/nuxt.config.ts), [web dependencies](../apps/web/package.json), [upload page](../apps/web/app/pages/admin/collections/[subdomain].vue), [ingestion dispatch](../packages/backend/convex/ingest.ts), [Convex HTTP routes](../packages/backend/convex/http.ts), [auth](../packages/backend/convex/auth.ts), [R2 service](../apps/web/server/utils/r2.ts).

## Concrete migration work

### 1. Use the adapter matching this repository

For the installed Nitro 2 line, use `cloudflare_module`, static assets, generated deployment configuration and Node compatibility. Pin a tested compatibility date. Nitro 2 provides bindings through `event.context.cloudflare.env`; its documentation also recommends request-scoped runtime-config access. Its Workers preset is preferred over Pages for new deployments. [Nitro 2 Cloudflare guide](https://v2.nitro.build/deploy/providers/cloudflare)

The current Cloudflare Nuxt guide offers automatic configuration through `wrangler deploy`. That command deploys: it must not be used merely to inspect compatibility. Also, its newest generated examples differ from Nitro 2's documented preset. Inspect the locked adapter and build output before selecting exact commands. [Cloudflare Nuxt guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/)

The web package imports `grammy` without declaring it. The lockfile has a grammY dependency under an `apps/telegram` importer, but that app is absent from the current tree. Correct the dependency ownership before trusting a clean install. Do not depend on an old local `node_modules` layout.

### 2. Replace Telegram's request-bound background work

Current behavior in [onPhoto.ts](../apps/web/server/api/telegram/_handlers/onPhoto.ts): send a starting message; run the remaining work through Vercel `waitUntil`; fetch the selfie from Telegram; create a search request; wait for Python to finish; subscribe to Convex; sign results and send photo groups.

Cloudflare `waitUntil` permits only up to 30 seconds after returning a response or disconnect. Raising the CPU limit does not extend that period. Python search is synchronous and can include model initialization and R2 reads, so cold searches plus result delivery cannot be assumed to fit. [Workers duration limits](https://developers.cloudflare.com/workers/platform/limits/#duration)

Use a short webhook acknowledgment and a continuation outside the webhook request's lifetime. The smallest candidate is the **existing Convex scheduler**, already used by ingestion, with an internal search/delivery action using the saved search request and Telegram identifiers. Reuse the current Python endpoint and result status. Avoid adding Cloudflare Queues, Durable Objects or a separate job system unless measurements expose a requirement that Convex cannot meet. This is a proposed design for the implementation phase, not code added by this assessment.

Convex scheduled actions execute at most once and are not automatically retried after transient failures. Therefore surface failures and allow a user retry; do not describe this candidate as guaranteed delivery. Verify the applicable action runtime/time limit and benchmark complete search-and-send duration before adopting it. [Convex scheduling semantics](https://docs.convex.dev/scheduling/scheduled-functions), [Convex limits](https://docs.convex.dev/production/state/limits)

The existing [webhook handler](../apps/web/server/api/telegram/[collectionId].ts) uses grammY's Node `http` adapter and `event.node.req/res`. Use a Fetch-compatible adapter at the Nitro boundary; grammY documents `cloudflare-mod` accepting a standard `Request` and returning a `Response`. Validate the precise H3 bridge locally. [grammY Workers support](https://grammy.dev/hosting/cloudflare-workers)

Two existing behaviors deserve correction during this focused work: `sendPhotoToAPI` does not reject non-2xx Python responses, and the subscription resolves its background promise on a progress update without unsubscribing. Neither provides reliable completion. The Python request already completes before subscription begins, so the subscription is also unnecessary for the normal successful path.

### 3. Preserve direct uploads and narrowly validate R2 access

Keep browser → signed R2 PUT uploads. Do not send conference ZIP archives through the Worker. R2 documents direct browser uploads using presigned URLs; signing still requires S3 credentials even if Worker reads later use an R2 binding. Presigned URLs use the S3 endpoint and require appropriate bucket CORS. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

The current R2 wrapper uses the AWS SDK and Node `Readable` streams. Test it under the actual Worker runtime before replacing it. If the preview stream is incompatible, a native R2 binding can return a web stream without changing storage layout; keep the signing path separate. Cloudflare also documents `aws4fetch` for signing with web-native APIs if SDK size becomes a measured issue. [Cloudflare aws4fetch example](https://developers.cloudflare.com/r2/examples/aws/aws4fetch/)

The selfie endpoint buffers multipart data before checking its 10 MiB photo limit and makes additional copies. Workers has a 128 MB memory budget per isolate, shared by concurrent requests. Validate request size early and exercise concurrent maximum-size selfies. Current documentation lists a 64 MiB uncompressed bundle limit on both plans, with no compressed-size limit; measure the built application and startup cost rather than relying on older 3/10 MB guidance. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

### 4. Keep authentication, ownership and billing in Convex

No D1 migration is needed. The browser uses Better Auth's cross-domain client against `NUXT_PUBLIC_CONVEX_SITE_URL`; the Nuxt API forwards bearer tokens through `ConvexHttpClient`. Maintain that arrangement.

Carry over public configuration (`NUXT_PUBLIC_ORIGIN`, Convex URL and site URL), Python URL and bucket identifiers. Store service and R2 credential values as deployment secrets. Test request-time runtime-config resolution with the pinned adapter; do not embed production secrets into a frontend build.

If the public hostname is preserved, most origins should stay unchanged. A temporary Workers hostname needs explicitly allowed staging origins in Convex auth and R2 CORS. Google login callbacks depend on the actual auth host; inspect them rather than rewriting them because the frontend moved. The Lemon Squeezy webhook in Convex should not move with Vercel.

### 5. Treat event hostnames as part of the product

[useSubdomain.ts](../apps/web/app/composables/useSubdomain.ts) treats the first label of almost any hostname as an event slug. A `workers.dev` preview host will therefore be mistaken for an event. Define how root, `www`, staging and event subdomains are recognized, then verify them under production-mode previews.

Inventory the existing domain, event wildcard DNS, certificates and Worker routing before cutover. Do not assume the main domain's successful deployment proves all event links work. Preserve existing event URLs and query-string behavior.

## Launch blockers discovered while tracing migration paths

These are present in the working tree, independent of the hosting provider. They were not fixed by this research task.

- **Private-photo authorization result is ignored.** [authorize.post.ts](../apps/web/server/api/r2/authorize.post.ts) awaits `authorizeImages`, then signs all submitted keys. [searchRequests.ts](../packages/backend/convex/searchRequests.ts) returns `false` when keys are outside the owned search result; it does not throw for that case. An authenticated user with a completed search could request signatures for unrelated known object keys. Require a successful authorization result before signing. Verify by submitting one allowed and one unrelated key.
- **Telegram webhook provenance is not checked.** The current handler accepts updates without checking a Telegram webhook secret; registration also omits `secret_token`. Register and validate that secret before public launch. Telegram provides `X-Telegram-Bot-Api-Secret-Token` for this purpose. [Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook)
- **Continuation and error handling are fragile.** Address the Telegram lifecycle described above before claiming reliable bot support on the new host.

## Costs and decision boundaries

| Item | Current published pricing / implication |
| --- | --- |
| Workers Free | 100,000 dynamic requests/day; 10 ms CPU per invocation. Useful for a static site and experiments; full Nuxt suitability is unmeasured. |
| Workers Paid | Minimum $5/account/month; includes 10 million requests and 30 million CPU ms/month. Excess: $0.30/million requests and $0.02/million CPU ms. |
| Static assets | Direct static-asset requests are free and unlimited. Routes that invoke the Worker incur its usage; optional Workers Caching has its own request-accounting caveat. |
| R2 Standard | $0.015/GB-month; $4.50/million Class A operations; $0.36/million Class B operations; free internet egress. Monthly free allowance: 10 GB-month, 1 million Class A, 10 million Class B. |
| Convex / Python | Remain separate costs; moving the website does not eliminate them. |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Prices are USD before tax. Existing account usage and storage retention affect actual cost.

Illustration, not a forecast: 100,000 dynamic requests/month at an assumed 20 ms each fit the Paid included allowances. Holding 100 GB in R2 Standard for a full month costs about $1.35 in storage after an otherwise-unused 10 GB allowance, before any billable operations. A whole-event price must also cover model compute, stored originals/ZIPs, retention and payment fees.

Python Workers are a Pyodide/WebAssembly environment, not a drop-in Linux container host. The current native ML stack needs a separate compatibility evaluation; do not assume that Workers' Python support replaces the existing service. Cloudflare Containers would be a distinct hosting choice covered by the Python-host assessment. [Python Workers packages](https://developers.cloudflare.com/workers/languages/python/packages/)

## Staged minimal migration plan

1. **Establish the baseline locally.** Preserve current WIP. Fix dependency ownership; reproduce the existing app build; capture routes and configuration names. Correct the two authorization/provenance blockers before internet launch.
2. **Build the same app for Workers.** Configure the Nitro 2 adapter, assets and pinned compatibility date. Remove the Vercel-only continuation after implementing the agreed Telegram flow. Run a local Wrangler preview; inspect bundle size, runtime config, streams and error responses.
3. **Verify a complete local/test journey.** Root landing page; organizer sign-in; event creation; direct ZIP upload; ingestion progress; attendee search; authorized download; denied access to another event's private objects; failed/cold searches; Telegram photo replies beyond 30 seconds. Exercise checkout and webhook handling with test configuration and isolated data.
4. **Request approval for a concrete staging deployment.** Present hostname, bindings, configuration, estimated plan cost and verification evidence. Use staging data/bucket prefixes and a test bot. Test root, event subdomains, auth redirects and large/concurrent uploads in the real environment.
5. **Request approval for production cutover.** Preserve URLs; move DNS/routes and update Telegram webhook registration only when necessary; retain the previous deployment for rollback. Inspect logs, search delivery and error rates before retiring Vercel.
6. **Migrate Python separately.** Change its URL only after a provider benchmark proves startup, ingestion and search behavior. Re-run the cross-service journey after that change.

Completion criteria: the actual Workers build runs the entire attendee/organizer journey; private objects remain private; Telegram delivery survives searches lasting longer than its webhook acknowledgment; all existing event URLs resolve; production settings and billing have been reviewed. Documentation support alone is not completion evidence.

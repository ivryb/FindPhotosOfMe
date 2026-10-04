# Release checklist

This records dashboard settings that cannot live in code. Hosting was subsequently
moved to Cloudflare and Modal; Google hosting/storage cleanup completed on
3 October 2026. See [the current deployment guide](../DEPLOYMENT.md) and
[Modal handoff](modal-handoff.md). The Google project still hosts the active OAuth
client and must be preserved.

## Current state (August 3, 2026)

- The Better Auth, ownership, upload, search, and server-to-server security changes exist locally but are not deployed.
- Google Auth Platform is configured and published for external users. The `FindPhotosOfMe web` client authorizes both Convex callback URLs; its credentials are stored in the development deployment only.
- Cloudflare Email Sending is wired in code, but its domain and API token are not configured yet.
- Lemon Squeezy store `444807` (`findphotosofme.lemonsqueezy.com`) is dedicated to FindPhotosOfMe and registered in Belgium. Development uses hidden test product `1264917`, Event variant `1977595`, Large Event variant `1977598`, and test webhook `123819`. Test order `9121562` verified checkout from the dedicated storefront and signed activation of the intended collection. The mistaken products and webhook were removed from Listenly; historical test orders remain only as harmless audit history.
- The dedicated Lemon Squeezy store still requires identity activation before Live mode is available. No live FindPhotosOfMe product or webhook exists yet.
- Convex has development `honorable-firefly-904` and production `merry-firefly-921` deployments. Development has Google OAuth, Better Auth, Lemon Squeezy test-mode, `SITE_URL`, `PYTHON_API_URL`, and `TELEGRAM_WEBHOOK_BASE_URL` configured. `SERVICE_TOKEN` and Cloudflare email variables are still missing. Production has not been changed during this work.
- `findphotosofme.com` and `www.findphotosofme.com` currently return Vercel `DEPLOYMENT_NOT_FOUND`. Attach and verify the production domain before using it as an auth origin.
- Cloud Run is still running the October 2025 image. It does not have the new shared `SERVICE_TOKEN`, so it is not compatible with the secured local code yet.
- Artifact Registry cleanup is active: keep the latest 3 versions of each package and delete versions older than 7 days. Google applies cleanup asynchronously.

## 1. Secrets to generate

Generate three different random values:

- `BETTER_AUTH_SECRET` — Convex only.
- `SERVICE_TOKEN` — the same value in Convex, Cloudflare Workers, and Modal.
- `LEMONSQUEEZY_WEBHOOK_SECRET` — 20 random bytes encoded as 40 hexadecimal characters.

Never expose either value through a `NUXT_PUBLIC_*` variable.

## 2. Convex deployment

Create or select the production Convex deployment, then configure:

| Variable | Value |
| --- | --- |
| `SITE_URL` | Final web origin, for example `https://findphotosofme.com` |
| `BETTER_AUTH_SECRET` | Generated auth secret |
| `GOOGLE_CLIENT_ID` | Google OAuth web-client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web-client secret |
| `LEMONSQUEEZY_STORE_ID` | Dedicated FindPhotosOfMe store: `444807` |
| `LEMONSQUEEZY_PRODUCT_ID` | Test: `1264917`; production: create after store activation |
| `LEMONSQUEEZY_TOP_UP_VARIANT_ID` | Pay-what-you-want "Balance top-up" variant; checkout sets the price. Create it in test and live mode |
| `LEMONSQUEEZY_API_KEY` | Dedicated FindPhotosOfMe API key |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Random 6–40 character signing secret |
| `LEMONSQUEEZY_TEST_MODE` | `true` in preview, `false` in production |
| `CLOUDFLARE_ACCOUNT_ID` | Account that owns the sending domain |
| `CLOUDFLARE_EMAIL_API_TOKEN` | Token limited to Email Sending: Edit |
| `AUTH_EMAIL_FROM` | Onboarded sender, for example `sign-in@findphotosofme.com` |
| `PYTHON_API_URL` | Cloud Run service URL, without a trailing slash |
| `SERVICE_TOKEN` | Shared server token |
| `LEGACY_OWNER_EMAIL` | Account that should own existing collections |
| `TELEGRAM_WEBHOOK_BASE_URL` | Public web origin plus `/api/telegram` if Telegram remains enabled |

`CONVEX_SITE_URL` is supplied by Convex. Verify that it matches the production deployment used for the auth callback.

Deploy the Convex functions only after these variables are set. Run the one-time legacy ownership claim, verify its result, then remove `LEGACY_OWNER_EMAIL` if the migration no longer needs it.

### Moving to the shared balance

Galleries used to be bought one plan at a time; now every account has one balance in dollars. On each deployment, once:

1. Create the top-up variant in Lemon Squeezy and set `LEMONSQUEEZY_TOP_UP_VARIANT_ID`. The old `LEMONSQUEEZY_EVENT_VARIANT_ID` and `LEMONSQUEEZY_LARGE_EVENT_VARIANT_ID` are no longer read.
2. Deploy the Convex functions, then run `bunx convex run migrations:moveToBalance` from `packages/backend` (add `--prod` for production). Each paid gallery's unused photos become balance credit for its owner, and every gallery keeps its end date. Running it again changes nothing.
3. Deploy Modal, then make thumbnails for photos uploaded before thumbnails existed: `modal run python/modal_app.py::backfill_thumbnails`. Until it finishes, the gallery grid shows the full photos in place of the missing thumbnails.
4. Deploy the web app. Old `/admin/collections/<address>` links redirect to `/admin/galleries/<address>`.

## 3. Google Auth Platform

Use a Web application OAuth client with this redirect URI:

```text
https://<production-deployment>.convex.site/api/auth/callback/google
```

The OAuth client authorizes both existing Convex callbacks:

```text
https://honorable-firefly-904.convex.site/api/auth/callback/google
https://merry-firefly-921.convex.site/api/auth/callback/google
```

The consent audience is External and published. Basic profile/email sign-in should not require sensitive-scope verification. Add the same client credentials to production Convex only as part of the approved production rollout.

## 4. Cloudflare Email Sending

Cloudflare DNS must manage the sender domain. In **Compute → Email Service → Email Sending**:

1. Onboard the sender domain and let Cloudflare add SPF, DKIM, DMARC, and bounce-handling records.
2. Confirm that the account is on Workers Paid. Arbitrary-recipient sending is unavailable on Workers Free; Workers Paid includes 3,000 outbound emails per month.
3. Create an API token limited to **Email Sending: Edit** for this account.
4. Put the account ID, token, and sender address in the Convex variables above.
5. Send a real OTP to a non-team address and check delivery, spam placement, and the Cloudflare email logs.

Convex calls Cloudflare's REST API directly. No Worker deployment is required.

## 5. Lemon Squeezy

1. Complete identity verification and activate the dedicated Belgian FindPhotosOfMe store. Live mode is unavailable until this is approved.
2. Keep test product `1264917` hidden from `findphotosofme.lemonsqueezy.com`; never create FindPhotosOfMe products or webhooks in another project's store.
3. Use separate test and live API keys. Both current keys expire on February 3, 2027; rotate them before then.
4. Development uses test webhook `123819` at `https://honorable-firefly-904.convex.site/api/lemonsqueezy/webhook`, subscribed only to `order_created` and `order_refunded`.
5. After activation, create the matching hidden live product in store `444807`. Add its IDs to production Convex, deploy the production webhook route, and only then create the live webhook.
6. Checkout, entitlement activation, idempotent redelivery, partial-refund recording, and full-refund revocation are verified in Test mode. Repeat the smoke test against the deployed preview origin before enabling live payments.
7. Switch `LEMONSQUEEZY_TEST_MODE` to `false` only for the approved production rollout.

## 6. Vercel

Configure all environments that will run the app (Production and the Preview environment used for launch testing):

| Variable | Value |
| --- | --- |
| `NUXT_PUBLIC_ORIGIN` | That environment's exact web origin |
| `NUXT_PUBLIC_CONVEX_URL` | Matching Convex `.convex.cloud` URL |
| `NUXT_PUBLIC_CONVEX_SITE_URL` | Matching Convex `.convex.site` URL |
| `NUXT_PYTHON_API_URL` | Cloud Run service URL |
| `NUXT_SERVICE_TOKEN` | Shared server token |
| `NUXT_R2_ACCOUNT_ID` | Existing R2 account ID |
| `NUXT_R2_BUCKET_NAME` | Existing bucket |
| `NUXT_R2_ACCESS_KEY_ID` | Existing scoped R2 key |
| `NUXT_R2_SECRET_ACCESS_KEY` | Existing scoped R2 secret |

Remove the obsolete `NUXT_PUBLIC_API_URL` and `NUXT_ADMIN_PASSWORD`. The browser must never receive the Python URL token or R2 credentials.

Attach `findphotosofme.com`, verify DNS and HTTPS, and only then use that origin for `SITE_URL` and `NUXT_PUBLIC_ORIGIN`.

## 7. Modal

Configure the `findphotosofme-backend` Modal Secret with:

| Variable | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Existing R2 account ID |
| `R2_BUCKET_NAME` | Existing bucket |
| `R2_ACCESS_KEY_ID` | Existing scoped R2 key |
| `R2_SECRET_ACCESS_KEY` | Existing scoped R2 secret |
| `CONVEX_URL` | Production Convex `.convex.cloud` URL |
| `SERVICE_TOKEN` | Shared server token |

Browsers do not call Python directly. Deployment and worker limits are defined in
`python/modal_app.py`; see [Python instructions](../python/README.md). Cloud Run and
Artifact Registry have been deleted; no Google hosting deployment is required.

## 8. End-to-end release gate

Use a non-production event and two unrelated accounts:

- Request and redeem an email OTP; verify expiry, retry limits, and invalid-code handling.
- Sign in with Google and verify return to `/admin`.
- Top up a balance through Lemon Squeezy and verify the webhook credits only that account; refund it and verify the credit is taken back.
- Create or claim a collection as organizer A.
- Confirm organizer B cannot view its admin data, request uploads, or inspect its jobs.
- Upload individual images and an archive; reject invalid type, oversized file, oversized archive, and path traversal attempts.
- Confirm the Python service rejects requests without the shared token.
- Complete ingest and face search as a signed-in attendee.
- Confirm another attendee cannot read the first attendee's search status or results.
- Confirm result URLs expire and private R2 objects are not publicly enumerable.
- Check Convex, Vercel, Cloud Run, Cloudflare Email, and browser logs for errors without recording OTPs or secrets.

Do not call the release complete until every item passes against the deployed preview environment.

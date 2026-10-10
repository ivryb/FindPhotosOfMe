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

Generate two different random values:

- `BETTER_AUTH_SECRET` — Convex only.
- `SERVICE_TOKEN` — the same value in Convex, Cloudflare Workers, and Modal.

Never expose either value through a `NUXT_PUBLIC_*` variable.

## 2. Convex deployment

Create or select the production Convex deployment, then configure:

| Variable | Value |
| --- | --- |
| `SITE_URL` | Final web origin, for example `https://findphotosofme.com` |
| `BETTER_AUTH_SECRET` | Generated auth secret |
| `GOOGLE_CLIENT_ID` | Google OAuth web-client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web-client secret |
| `CREEM_API_KEY` | Creem API key; a test key (`creem_test_…`) sends checkouts to Creem's sandbox |
| `CREEM_PRODUCT_ID` | The "Balance top-up" product from the same mode as the key |
| `CREEM_WEBHOOK_SECRET` | Signing secret of the webhook endpoint in that mode |
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

1. Deploy the Convex functions, then run `bunx convex run migrations:moveToBalance` from `packages/backend` (add `--prod` for production). Each paid gallery's unused photos become balance credit for its owner, and every gallery keeps its end date. Running it again changes nothing.
2. Deploy Modal, then make thumbnails for photos uploaded before thumbnails existed: `modal run python/modal_app.py::backfill_thumbnails`. Until it finishes, the gallery grid shows the full photos in place of the missing thumbnails.
3. Right after deploying Modal and before deploying the web app, move the old face indexes to the new format: `modal run python/modal_app.py::convert_face_indexes`. Search reads only the new format, so older galleries find nothing until this has run. It must finish before uploads reopen with the new web app, because it rewrites the same index file that merges write. Running it again changes nothing.
4. Deploy the web app. Old `/admin/collections/<address>` links redirect to `/admin/galleries/<address>`.

### Photo uploads

The browser now uploads each photo straight to R2 (it unpacks ZIPs itself), and up to ten Modal workers process them 50 at a time while the rest upload. See [the Python instructions](../python/README.md#execution).

- The bucket's CORS policy must allow `PUT` from the site's origin with a `Content-Type` header. It already allows ZIP uploads this way; check that it isn't limited to `application/zip`.
- Add an R2 lifecycle rule that deletes objects under `uploads/` after 7 days. Processed photos leave there within minutes; what stays is from uploads that stopped and were never added again.
- Convex runs `uploads:recover` every two minutes (`convex/crons.ts`); it retries work whose worker went quiet.
- Old ZIP jobs stay in the `ingestJobs` table, which nothing reads. Once they're deleted, the table can be removed from the schema.

### Launching before payments open

The first release ran without payments. Leave `NUXT_PUBLIC_PAYMENTS` unset: Top up then says top-ups open soon, and new accounts use their free trial credit (about 500 photos and 50 searches, galleries online 7 days).

Sign in once with the admin account, then give it credit from `packages/backend` (amounts are in thousandths of a dollar, so this is $100):

```
bunx convex run balances:grant '{"email":"ivrybn@gmail.com","amount":100000}' --prod
```

Credit added this way also takes the account's galleries out of the trial. Run it again when the balance runs low. Once Creem is configured (section 5), set `NUXT_PUBLIC_PAYMENTS=true`.

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

## 5. Creem

Creem replaced Lemon Squeezy, whose store activation was rejected, as the merchant of record. The old Lemon Squeezy store and its `LEMONSQUEEZY_*` Convex variables are no longer used.

1. The FindPhotosOfMe store on Creem was approved and went live on 9 October 2026. Payouts go to a Ukrainian bank account.
2. Top-ups sell one product, "Balance top-up" (the test product is still called "FindPhotosOfMe credit"): one-time, $10, tax added on top (`tax_mode: exclusive`). Each checkout sets its own price with `custom_price`, so the product price only matters as a floor. Test product: `prod_5cwqyBzktRp7Nfx0CpotfW`; live product: `prod_3os1uBEijbcMrH3qR4CqxT`. Create products through the API: CLI 0.9.0 drops `--billing-type` and the request fails. Branding (logo `icon-512.png`, light theme, accent `#FFD21F`, hover `#FFDC4D`, text `#151515`) is set by hand under Settings → Branding; the API has no endpoint for it.
3. Test and live mode have separate API keys, products and webhook endpoints, each endpoint with its own signing secret. Keep all three Convex variables from the same mode.
4. Register the webhook at `https://<deployment>.convex.site/api/creem/webhook` for `checkout.completed` and `refund.created`. `creem listen --forward-to <url>` forwards test-mode events with real signatures to a local server.
5. Payments went live on 9 October 2026. Convex production `merry-firefly-921` holds the live key, product and the signing secret of live webhook `wh_1Q1ENRtNqB5cPs6V2K645I`; development `honorable-firefly-904` uses the test product and test webhook `wh_test_49DD3irnvJrtWstSTWv0qM`, and the Worker has `NUXT_PUBLIC_PAYMENTS=true`. The `LEMONSQUEEZY_*` variables were removed. A correctly signed event for another product was rejected at the product check, and a live checkout opened with a custom price; no real purchase has been made yet.
6. On 9 October 2026, a $12.34 test checkout delivered `checkout.completed` with the owner's ID in `metadata` and the amounts in cents (`amount_paid`, `tax_amount`). A full refund through the API delivered `refund.created` carrying only that refund's `refund_amount`; `transaction.refunded_amount` was empty. Make one real $10 purchase on a live account and refund it to confirm the deployed webhook end to end.

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
| `NUXT_PUBLIC_PAYMENTS` | `true` once Creem is configured; unset until then |

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
- Top up a balance through Creem and verify the webhook credits only that account; refund it and verify the credit is taken back.
- Create or claim a collection as organizer A.
- Confirm organizer B cannot view its admin data, request uploads, or inspect its jobs.
- Upload individual images and an archive; reject invalid type, oversized file, oversized archive, and path traversal attempts.
- Confirm the Python service rejects requests without the shared token.
- Complete ingest and face search as a signed-in attendee.
- Confirm another attendee cannot read the first attendee's search status or results.
- Confirm result URLs expire and private R2 objects are not publicly enumerable.
- Check Convex, Vercel, Cloud Run, Cloudflare Email, and browser logs for errors without recording OTPs or secrets.

Do not call the release complete until every item passes against the deployed preview environment.

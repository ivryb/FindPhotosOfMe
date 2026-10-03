# Portfolio launch

## Product and pricing

The simplest sellable unit is one event, not a subscription. Attendees search free; organizers or photographers pay to host and process a collection.

Initial pricing to test:

- Demo — free, up to 250 photos, expires after 7 days.
- Event — $49, up to 5,000 photos, available for 60 days.
- Large event — $149, up to 20,000 photos, available for 90 days.
- Larger or recurring use — talk to us.

Payments use one hidden Lemon Squeezy product, `FindPhotosOfMe — Event Photo Search`,
with one-time Event and Large Event variants in the dedicated FindPhotosOfMe store
`444807`. Test mode uses product `1264917` (`1977595` / `1977598`). Create the
matching live product only after Lemon Squeezy approves the new store for Live mode.
The free demo is created directly in the app and does not go through checkout. A signed
`order_created` webhook activates the purchased collection; full refunds revoke its paid
entitlement and partial refunds are recorded for review.

This is positioning, not proven unit economics. Before accepting payment, benchmark one 5,000-photo ingest and 100 searches, measure Cloud Run CPU/RAM time and R2 storage/egress, then preserve at least an 80% gross margin. Do not add subscription or billing tables until a real customer needs recurring billing.

## Infrastructure decision

Keep the current architecture for launch:

- Nuxt on Vercel.
- Auth and application data on Convex.
- Original photos, embeddings, and archives in Cloudflare R2.
- InsightFace/ONNX Python service on Cloud Run, scaling to zero.

In the July 2026 Google Cloud invoice, the project cost $3.157479: $2.612525 Artifact Registry, $0.529686 tax, and $0.015268 Cloud Storage. Artifact Registry held 26.631688 GiB-month. The Python compute itself did not create a material charge.

Migrating the model service now would trade a small, understood bill for deployment work and a new cold-start/reliability profile. First delete old images and add an Artifact Registry cleanup policy that keeps the latest 3 versions per package. At Google's current $0.10/GiB-month above the 0.5 GiB free tier, shrinking the repository to roughly 2–4 GiB should make the registry bill negligible.

Reconsider Cloud Run only after measured event workloads exceed its free tier or cold starts damage the user experience. A migration benchmark must include model image size, startup time, at least 2 GiB RAM, AVX-capable CPU, request duration, concurrency, and outbound traffic—not just the provider's headline monthly price.

## Public launch boundaries

- Every organizer event is owned by a Better Auth user.
- Public event queries expose only title, description, photo count, and selected preview keys.
- Reference-photo search requires sign-in; search status and results are requester-owned.
- Private result images use 15-minute R2 signed URLs.
- Upload signing requires event ownership and an event-scoped object key.
- The Python API accepts only a shared server token and is no longer callable from browsers.
- Uploads are limited to supported image types/10 MB; archives have compressed, expanded-size, and file-count limits.
- Descriptions render as text, closing the stored-HTML injection path.
- The bucket-wide delete endpoint and client-forgeable admin cookie are removed.

## Required configuration before release

Use `docs/release-checklist.md` for the exact dashboard variables and validation order.

1. Configure the environment variables in each `.env.example`; use one generated `SERVICE_TOKEN` across Nuxt, Convex, and Python.
2. In Google OAuth, add the Better Auth callback shown by the deployed Convex auth routes and set the production site origin.
3. Set `LEGACY_OWNER_EMAIL` once so the existing unowned event can be claimed by the intended account.
4. Onboard the sending domain in Cloudflare Email Service, create a token with Email Sending: Edit, and configure the Cloudflare email variables in Convex. Sending OTPs to arbitrary users requires the Workers Paid plan; it includes 3,000 outbound emails per month.
5. Add the Artifact Registry cleanup policy after reviewing the repository with an account that has `artifactregistry.repositories.list` and update/delete permissions.
6. Run the complete organizer and attendee journeys against a non-production test event before deployment.

## Deliberately not added yet

Organizations, team membership, recurring subscriptions, and seats are not needed for a one-owner, pay-per-event launch. Add them when the first real workflow requires team access or recurring billing; otherwise they are expensive furniture in an empty room.

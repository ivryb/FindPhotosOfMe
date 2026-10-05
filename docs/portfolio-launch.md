# Product and billing

## Product and pricing

Organizers or photographers pay once per event. Attendee search is free. Keep seats and team billing out of launch scope. Personal find-and-export jobs and ongoing archives are distinct proposed offers; archive subscriptions need their own storage and renewal behavior.

The pricing direction selected on 4 October is **one calculator with a $10 minimum payment**, replacing the fixed paid plans on the landing pages. The purchase will use a custom-priced checkout in the dedicated FindPhotosOfMe Lemon Squeezy store. The ink contact-sheet calculator design is selected; custom checkout and its entitlements are the next implementation step.

The free-trial proposal remains 500 submitted photos / 2 GB, 50 searches, and seven days, with one active trial per account and 500 total trial submissions. Photo and byte limits both apply; attendees never pay. These trial terms are not yet implemented entitlements.

The calculator's draft rates are $0.005 per uploaded photo, $0.015 per selfie search, and $0.10/GB per additional 30 days beyond the first included 30 days. Owners choose the date a gallery goes offline; each day past the included time is taken from the balance at the gallery's current size, and a gallery the balance can't cover goes offline. It estimates storage at 5 MB/photo and offers 30, 90, or 180 days. The estimate is `max(10, photos × 0.005 + searches × 0.015 + estimated GB × 0.10 × (days / 30 − 1))`. The $10 minimum applies to the total payment, not an additional fee.

The landing section uses one calculator: ink controls beside a yellow price panel, topped by a grid of tiles that shows the photo count (one tile per 100 photos). The rates live in `apps/web/app/utils/pricing.ts`. Before wiring checkout, settle how estimated usage becomes purchased capacity and how actual file sizes, additional searches, and extensions affect the charge. No automatic usage billing is implemented by this preview.

The [3 October analysis](pricing-cost-analysis.md) uses the earlier $19/100-photo proposal; its cost assumptions remain a reference, not the current offer. The analysis includes 100–500,000-photo scenarios, 100–5,000 searches, 30/90-day retention, recurring archive pricing, payment contribution, and a [runnable cost model](pricing-cost-model.py). Public provider rates are verified; processing times, photo sizes and workload usage remain assumptions. Confirm them against representative Modal workloads and account bills, and include model licensing before finalizing prices. Do not price permanent retention from a one-time event payment or allocate shared provider credits separately to every customer.

The implemented photo limits and availability periods live in [collections.create](../packages/backend/convex/collections.ts) for the demo and [PLANS](../packages/backend/convex/payments.ts) for paid events. Review those values with the price decision. Demo availability starts at event creation; paid availability starts at purchase. Neither clock waits for the organizer to finish uploading.

Availability expiry is not automatic deletion. The proposed policy starts paid availability when a ready event is published, with a deadline to publish and a disclosed seven-day recovery window after expiry. This differs from current behavior. Agree on retention, deletion, and refund terms, then verify that the application enforces what the offer promises. Personal archives additionally require keeping photos without detected faces; the current importer discards them. Large individual libraries need indexing, memory and result-capacity validation before sale.

## Billing rules

Use only the dedicated FindPhotosOfMe Lemon Squeezy store. Keep its products, credentials, and webhooks separate from other projects, including Listenly.

The [backend environment example](../packages/backend/.env.example) lists the required billing variables. Read the configured environment and provider account for current store, product, and variant IDs. Historical test IDs do not establish the live configuration or store approval status.

The current [payment implementation](../packages/backend/convex/payments.ts) does the following:

- An event owner requests checkout for the Event or Large Event variant. Checkout carries the event and owner identifiers.
- A signed paid-order webhook grants the plan after the handler checks the configured store, product, variant, and event owner. The checkout redirect does not grant access.
- Repeated notifications for the same order reuse its stored record.
- A full refund marks the event as refunded. A partial refund updates the order record and keeps the event's entitlement.

Existing paid events cannot purchase another plan through the current checkout action. Upgrades and renewals need a product decision before the UI offers them.

## Before accepting live payments

Confirm the dedicated store's live approval, product prices, currency, variants, webhook destination, and signing secret. Keep test and live configuration separate and verify that events from the wrong environment cannot grant live access.

Use test orders to verify successful activation, repeated delivery, invalid signatures, wrong store or variant, and ownership mismatches. Test full and partial refunds, expiry, photo limits, and access to prior results after expiry or refund. Record the outcomes rather than treating the presence of a handler as proof that billing works.

Finish the organizer and attendee journey, resolve model licensing, and publish the agreed contact, privacy, retention, and refund information before enabling paid self-service.

For hosting and service configuration, read [DEPLOYMENT.md](../DEPLOYMENT.md).

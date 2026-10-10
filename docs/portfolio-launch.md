# Product and billing

## Product and pricing

Organizers or photographers pay once per event. Attendee search is free. Keep seats and team billing out of launch scope. Personal find-and-export jobs and ongoing archives are distinct proposed offers; archive subscriptions need their own storage and renewal behavior.

The pricing direction selected on 4 October is **one calculator with a $10 minimum payment**, replacing the fixed paid plans on the landing pages. The dashboard's Top up dialog uses the same ink contact-sheet calculator: its total becomes the price of a custom-priced Creem checkout, and that chosen amount becomes balance credit, before tax and any promo code. Unused credit is refundable within 14 days of purchase.

The free-trial proposal remains 500 submitted photos / 2 GB, 50 searches, and seven days, with one active trial per account and 500 total trial submissions. Photo and byte limits both apply; attendees never pay. These trial terms are not yet implemented entitlements.

The rates, lowered on 8 October 2026 to target about 50% margin after infrastructure and payment fees, are $0.002 per uploaded photo, $0.01 per selfie search, and $0.05/GB per additional 30 days beyond the first included 30 days. New accounts get free credit for 1,000 photos and 50 searches. Owners choose the date a gallery goes offline; each day past the included time is taken from the balance at the gallery's current size, and a gallery the balance can't cover goes offline. It estimates storage at 5 MB/photo and offers 30, 90, or 180 days. The estimate is `max(10, photos × 0.002 + searches × 0.01 + estimated GB × 0.05 × (days / 30 − 1))`. The $10 minimum applies to the total payment, not an additional fee.

The landing section uses one calculator: ink controls beside a yellow price panel, topped by a grid of tiles that shows the photo count (one tile per 100 photos). The rates live in `packages/backend/convex/pricing.ts`; pages read their price copy from `PRICE_TEXT` in `apps/web/app/utils/pricing.ts`. The estimate only sets the payment: actual photos, searches, and storage days are charged to the balance as they happen.

The [3 October analysis](pricing-cost-analysis.md) uses the earlier $19/100-photo proposal; its cost assumptions remain a reference, not the current offer. The analysis includes 100–500,000-photo scenarios, 100–5,000 searches, 30/90-day retention, recurring archive pricing, payment contribution, and a [runnable cost model](pricing-cost-model.py). Public provider rates are verified; processing times, photo sizes and workload usage remain assumptions. Confirm them against representative Modal workloads and account bills, and include model licensing before finalizing prices. Do not price permanent retention from a one-time event payment or allocate shared provider credits separately to every customer.

The implemented photo limits and availability periods live in [collections.create](../packages/backend/convex/collections.ts) for the demo and [PLANS](../packages/backend/convex/payments.ts) for paid events. Review those values with the price decision. Demo availability starts at event creation; paid availability starts at purchase. Neither clock waits for the organizer to finish uploading.

Availability expiry is not automatic deletion. The proposed policy starts paid availability when a ready event is published, with a deadline to publish and a disclosed seven-day recovery window after expiry. This differs from current behavior. Agree on retention, deletion, and refund terms, then verify that the application enforces what the offer promises. Personal archives additionally require keeping photos without detected faces; the current importer discards them. Large individual libraries need indexing, memory and result-capacity validation before sale.

## Billing rules

Payments go through the FindPhotosOfMe store on Creem, the merchant of record. Keep its products, credentials, and webhooks separate from other projects, including Listenly.

The [backend environment example](../packages/backend/.env.example) lists the required billing variables. Read the configured environment and Creem account for the current product ID. Historical test IDs do not establish the live configuration or store approval status.

The current [payment implementation](../packages/backend/convex/payments.ts) does the following:

- A signed-in owner opens checkout from the Top up dialog for the calculator's total, between $10 and $1,000. Checkout carries the owner's identifier.
- A signed `checkout.completed` webhook first checks the configured product, then credits the chosen amount to that owner's balance before tax and any promo code, so a 100% code still credits in full. Test and live mode have separate products and signing secrets, so test payments can't credit a live deployment. The checkout redirect credits nothing.
- Repeated notifications for the same order reuse its stored record.
- Each `refund.created` webhook takes back its share of the credit once, and the balance may go below zero.

## Before accepting live payments

Confirm the live product's price, currency, webhook destination, and signing secret. Keep test and live configuration separate and verify that events from the wrong environment cannot grant live access.

Use test orders to verify successful activation, repeated delivery, invalid signatures, wrong product, and ownership mismatches. Test full and partial refunds, expiry, photo limits, and access to prior results after expiry or refund. Record the outcomes rather than treating the presence of a handler as proof that billing works.

Finish the organizer and attendee journey and resolve model licensing before enabling paid self-service. The [Terms](../apps/web/app/pages/terms.vue), [Privacy](../apps/web/app/pages/privacy.vue) and [Refunds](../apps/web/app/pages/refunds.vue) pages are linked from every landing footer, with `support@findphotosofme.com` as the contact; Cloudflare Email Routing forwards it to the owner's inbox. The Privacy page describes what the code does with selfies, face data and retention, so update it whenever that changes. The pages name the operator as Ivan Rybnikov, an individual based in Ukraine, and the Terms are governed by Ukrainian law; no postal address is published.

For hosting and service configuration, read [DEPLOYMENT.md](../DEPLOYMENT.md).

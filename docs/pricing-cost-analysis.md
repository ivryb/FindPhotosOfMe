# Pricing and infrastructure cost analysis

Decision date: 3 October 2026. Proposal for Ivan; no checkout, entitlement, deployment or provider-account changes. USD before tax. Retention scope confirmed by Ivan: compare 30/90-day events and ongoing personal archives.

## Recommendation

Keep one-time event purchases and free attendee access. Offer a 100-photo trial, a $19 small event, a $49 event and a $149 large event. Pair photo limits with byte limits and a finite availability period. For individuals, distinguish a one-time find-and-export job from recurring storage. Do not bundle indefinite retention into a one-time price.

These are viable **candidate prices under the explicit cost assumptions below**, not validated willingness-to-pay or exact production costs. The existing $49/$149 drafts are economically plausible; the migration does not itself justify a price increase. Representative Modal benchmarks, account usage and the model license quote remain missing.

## Evidence and current behavior

Authoritative evidence is the current working-tree implementation, migration handoff, and official provider rates. Existing uncommitted changes were preserved. No production data, invoices or workload benchmarks were fetched; no live workloads were submitted. [Provider rates and citations](infrastructure-provider-rates.md), [runnable calculations](pricing-cost-model.py).

- [Modal](../python/modal_app.py): ingestion requests 1 physical core/4 GiB, max one container; search 1 core/2 GiB, max two containers. Zero minimum containers; 10-second ingest/API idle windows, 60-second search window. Billed usage can exceed requested resources. The two-photo smoke test in the [handoff](modal-handoff.md) is not a throughput benchmark.
- [Importer](../python/endpoints/upload_collection.py): reads ZIPs sequentially, uploads original bytes only for photos with detected faces, rewrites the whole collection index after each ZIP, and removes the successful source ZIP. A personal archive must preserve non-face photos too. The cost model assumes every submitted photo is retained to avoid pricing around data loss.
- [Search](../python/endpoints/search_photos.py): reloads the whole embeddings JSON on every search; Python scans faces. Embeddings are in R2, not a Convex vector index. Faces per photo and collection size influence time and memory.
- [Telegram](../packages/backend/convex/telegram.ts): Workers receives the webhook, but a Convex Node action downloads the selfie, waits for Modal, and sends result URLs. Original downloads use R2; they are not all proxied through Convex.
- Current demo entitlement is 250 photos/7 days; paid entitlements are 5,000/60 days and 20,000/90 days. Expiry does not delete stored bytes. Renewals, upgrades, personal storage subscriptions, byte quotas and search quotas are not currently implemented. [Collections](../packages/backend/convex/collections.ts), [payments](../packages/backend/convex/payments.ts).

## Rates versus estimates

The configured ingest shape costs $0.079128 per occupied hour and search $0.063144/hour at requested resources. Modal's HTTP gateway is additional. Application startup and warm retention are billable. R2 Standard is $0.015/decimal GB-month. Modal outbound uploads to R2 cost $0.04/binary GiB after its shared 1 TiB monthly allowance. This egress billing began 1 October 2026. [Modal pricing](https://modal.com/pricing), [egress](https://modal.com/docs/guide/network-egress-billing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Workers Paid is $5/account/month, covering website and bot together; the modeled traffic fits its included requests/CPU. Convex Starter is $0 base plus usage, whereas Professional adds $25/developer/month. Actual plans, region and existing allowance consumption were not verified. See the provider-rate document for their metered rates, shared allowances and source links.

**Gross variable allocation** below charges every resource at its usage rate without free allowances. It excludes fixed plans. This is useful for sustainable unit economics after the product grows; it is not a rounded invoice. **Account cash illustration** applies allowances once to the whole scenario, uses R2 rounding and adds the $5 Workers plan. It assumes otherwise unused Modal Starter and US Convex Starter accounts, not our verified current subscriptions.

## Scenario assumptions

| Input | Assumption, not a measurement |
| --- | --- |
| Original size | 5 MB decimal per photo; sensitivity at 2 and 15 MB |
| Processing | 2 occupied ingest seconds/photo; sensitivity 0.5–5 seconds; this includes amortized I/O/index work |
| Faces/index | 2 faces/photo; 12 kB JSON/face |
| Import batches | Target 2 GB source ZIP, below the actual 2 GiB cap; 30 extra seconds/batch for startup and idle |
| Source ZIP overlap | One day before successful deletion; failed/abandoned ZIP retention is extra |
| Search active time | `10 + 2 × photos_in_largest_collection / 5,000` seconds, covering selfie inference, index download/parse/scan and service calls |
| Search sessions | Every search isolated: 20-second cold allowance + 60-second retained search idle; burst sessions share these costs |
| Telegram | 100% of searches use a 512 MiB Node action through active search, cold allowance and 10 seconds of delivery; elapsed-time billing is a conservative metering assumption |
| Downloads | 30 photo GETs/search plus index GET; originals remain in Standard R2 |
| Convex traffic | 3 calls/photo + 20/search + 20/import batch; 10 kB database I/O/call; 2 kB egress/call; 0.5 MB selfie/search; metadata/index estimates in script |
| Workers | 8 dynamic calls/search + 50/event + 4/batch, at 20 ms CPU/call |
| Time window | All photos uploaded once near start; fully retained 30 or 90 days; searches are totals across that period |

No GPU, Modal Volume or Convex vector-index cost is added because the current path does not use them. Model licensing, payment fees, taxes, refunds, support, acquisition and engineering are excluded from infrastructure totals. Optional observability/build overages, repeated failed imports, extra traffic and resource consumption above requests need measured allocation. The ranges below are sensitivity scenarios, not statistical confidence intervals or guaranteed upper bounds.

## Hundreds of thousands of photographs

These are **portfolio totals split into collections of at most 5,000 photos**. For example, 100,000 photos means twenty events. This matches a supportable modeling unit; it does not assert that one 100,000-photo collection works today.

Gross variable USD, 30-day retention:

| Photos uploaded and retained | 100 searches | 1,000 searches | 5,000 searches |
| --- | ---: | ---: | ---: |
| 100 | $0.40 | $3.71 | $18.43 |
| 1,000 | $0.70 | $4.03 | $18.85 |
| 5,000 | $2.06 | $5.48 | $20.72 |
| 20,000 | $7.09 | $10.52 | $25.75 |
| 100,000 | $33.92 | $37.34 | $52.58 |
| 300,000 | $100.99 | $104.42 | $119.65 |
| 500,000 | $168.06 | $171.49 | $186.72 |

Retention comparison, **1,000 searches total** in either period:

| Photos | 30-day gross variable | 90-day gross variable | 30-day account cash illustration | Assumed ingest hours |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | $4.03 | $4.19 | $5.00 | 0.6 |
| 5,000 | $5.48 | $6.24 | $5.24 | 2.9 |
| 20,000 | $10.52 | $13.53 | $6.41 | 11.5 |
| 100,000 | $37.34 | $52.42 | $13.17 | 57.7 |
| 300,000 | $104.42 | $149.64 | $47.10 | 173.2 |
| 500,000 | $171.49 | $246.86 | $103.92 | 288.6 |

For gross 90-day totals, add three months of whichever fixed plans actually apply. Do not compare the gross columns directly with cash as though they had the same scope. Do not apply the one-month credit calculation to 90 days; usage timing and each month's other traffic matter. A steady arrival of 100,000 photos/month with 90-day retention eventually holds approximately 300,000 photos, plus temporary ZIPs. Ingestion remains 100,000 new photos/month.

The $37.34 example decomposes to $7.79 R2 storage including ZIP overlap, $6.28 Modal compute including search/API, $19.27 Modal egress, $0.46 R2 operations, $3.53 Convex, and $0.01 Workers usage allocation. At low account utilization, the $19.27 egress and compute allocation can be covered by shared allowances. Downloads from R2 have no bandwidth fee; 5,000 searches each downloading thirty 5 MB originals is 750 GB of delivery, plus request charges.

Every additional 1,000 isolated searches across these 5,000-photo events adds about $3.81 gross under the assumptions. Warm bursts reduce this; a 5,000-photo event with 1,000 searches costs $3.34 gross at 10% isolated sessions versus $5.48 at 100%. Slow index parsing, large result sets and Telegram delivery can increase it.

### Size and runtime sensitivity

100,000 photos, 1,000 searches, 30 days, same portfolio structure:

| Average photo | 0.5 s/photo | 2 s/photo | 5 s/photo |
| --- | ---: | ---: | ---: |
| 2 MB | $17.70 | $21.00 | $27.59 |
| 5 MB | $34.05 | $37.34 | $43.94 |
| 15 MB | $88.36 | $91.65 | $98.25 |

Photo size changes storage, upload egress and batch count; time changes ingestion compute. Real workloads may correlate these variables, so the table is not a promise of equivalent performance. Cost ceilings need byte limits, not photo counts alone.

## Proposed event policy

| Offer | Price | Submitted photos / originals | Availability | Included searches |
| --- | ---: | --- | --- | ---: |
| Trial | Free | 100 / 500 MB | 7 days | 20 |
| Small event | $19 once | 1,000 / 5 GB | 30 days | 300 |
| Event | $49 once | 5,000 / 25 GB | 90 days | 1,000 |
| Large event | $149 once | 20,000 / 100 GB | 90 days | 5,000 |

Whichever photo/byte limit is reached first applies. Index bytes are a platform allowance rather than a confusing customer-facing quota; the model budgets them. Photo limits count submitted images, including no-face images, to bound compute. One active free trial per account, with 100 total trial uploads rather than endless delete/re-upload cycles. A trial at the quota above has about $0.10 gross modeled infrastructure cost; 10,000 fully used trials would allocate roughly $1,015 before shared allowances and fixed plans.

Attendees never pay. Search packs, if required, are purchased by the organizer; an initial candidate is $15/1,000 additional searches. Notify the organizer as use approaches the allowance and define a grace policy so a live event does not abruptly stop. Do not advertise unlimited searches without an operational abuse policy. These limits and packs are proposals, not existing enforcement.

Prefer starting paid availability when the organizer publishes a ready event, with a clear deadline to publish, rather than charging access time during a long import. This is a product change: current paid expiry starts at purchase. Define deletion at expiry plus a disclosed seven-day recovery window, notify the owner in advance, and offer a paid extension. The table models 30/90 storage days; a seven-day grace adds about $0.0000176 per 5 MB photo ($0.35 for 20,000 photos), plus any searches enabled then. Cleanup must include source ZIPs, originals and face indexes; private old result links must stop authorizing access too.

At full quota, use the single-collection model for each offer:

| Paid offer | Gross infrastructure | Illustrative payment fee | Contribution before fixed plans/license/support |
| --- | ---: | ---: | ---: |
| $19 | $1.44 | $1.74 | $15.82 (83%) |
| $49 | $6.24 | $3.69 | $39.07 (80%) |
| $149 | $31.06 | $10.19 | $107.75 (72%) |

Fees assume 6.5% + $0.50, international card, no checkout tax. The percentage is actually applied to tax-inclusive payment; PayPal, payout and subscription surcharges can add more. This is contribution, not net profit. A 2× infrastructure stress case leaves approximately 76%, 67% and 51% respectively before the same excluded costs. Full large-event cost is higher than a portfolio with 20,000 photos because its searches and repeated index rewrites span one larger collection. [Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees).

Allocate fixed costs across paying customers: $5/month costs $0.50/event at ten paid events/month; adding one $25 Convex developer seat makes that $3/event. An unknown $L/month model license adds $L divided by paid events; do not silently treat it as zero. These cost calculations support testing the proposed prices; they do not establish customer demand.

## Individuals: filtering versus an ongoing archive

**Find and export:** one-time private processing, downloads and 30-day availability. Candidate prices are $9 for 5,000 photos/25 GB, $29 for 20,000/100 GB, and $99 for 100,000/500 GB, with 100 searches. At 5 MB/photo the portfolio model allocates about $2.06/$7.09/$33.92 of infrastructure respectively, before fees and fixed costs. These are private-use concepts, not discounted public event galleries. The larger two prices require actual single-library benchmarking or an intentional partitioned-library experience; portfolio costs are only an economic reference.

**Ongoing searchable storage:** initial indexing charged separately as above; then price capacity, including retained originals and index overhead. Suggested annual plans, with monthly alternatives:

| Capacity | Approx. 5 MB originals before index allowance | Monthly / annual price | Raw R2 storage/year at full capacity |
| --- | ---: | ---: | ---: |
| 100 GB | about 19,900 photos | $5 / $49 | $18 |
| 500 GB | about 99,500 photos | $25 / $249 | $90 |
| 1 TB | about 199,000 photos | $49 / $499 | $180 |

Initial indexing is not charged again on renewal. Charge processing for new additions beyond a clearly stated small allowance; do not promise unlimited re-indexing. Include a modest personal allowance such as 100 searches/month and make large library performance a prerequisite. At 7% + $0.50 annual payment fees, storage-only contribution is approximately 55%–57%; ongoing search, metadata, support and license costs reduce it. These prices need positioning around face finding and organization, not merely storage capacity. Annual payments reduce the impact of the fixed transaction fee. Keep originals on R2 Standard initially; IA saves only $0.005/GB-month and introduces retrieval charges.

Start with the event product and a paid find-and-export pilot. Ongoing archives require preserving every photo, an explicit recovery/deletion policy, renewals and large-library performance work. The present face-only importer is not a complete archive or backup service.

## Why one giant library is not yet a sellable capacity promise

At two faces/photo and 12 kB/face, the full JSON index is approximately 2.4 GB for 100,000 photos, 7.2 GB for 300,000 and 12 GB for 500,000, before parsed Python objects, a second byte copy and the model. This exceeds the requested 2 GiB search memory at 100,000, though Modal may allocate/bill more. Current five-minute search timeouts and sequential scans need real capacity validation.

At 5 MB/photo, source ZIPs hold about 400 photos. Rewriting the growing index after every ZIP uploads approximately 301 GB of index data for one 100,000-photo library, 2.70 TB for 300,000, and 7.51 TB for 500,000. Twenty separate 5,000-photo collections totaling 100,000 photos upload only about 17.4 GB of index data. Their processing times cannot be extrapolated interchangeably.

The current Convex result is one array/document. Convex limits arrays to 8,192 elements and documents to 1 MiB. A personal library containing many photos of its owner can hit this before the nominal photo limit. [Convex limits](https://docs.convex.dev/production/state/limits). This matters directly to the archive offer; pagination and an appropriate index representation are needed before large-library promises. No architecture changes are implemented by this analysis.

One ingest container means the modeled 100,000-photo portfolio requires roughly 58 hours of occupied processing and 500,000 requires 289 hours. Low dollar cost is not fast turnaround. Do not sell a same-day import SLA based on these estimates.

## Replace assumptions with billable measurements

Before finalizing the offers, benchmark a representative 1,000/5,000-photo event and a crowded event on the deployed worker shape, then a 20,000-photo event. Record submitted/stored bytes, faces, index bytes, per-batch time, requested versus consumed CPU/RAM, cold starts and retained idle intervals. Record cold, warm and concurrent web/Telegram searches, p50/p95 duration, result count and delivery time. Reconcile Modal compute/egress, R2 operations/GB-days and Convex usage attribution to the test window. Rerun this calculator with those inputs and the actual shared account utilization.

Inspect the existing account plans and region. Billing data from the retired Cloud Run service cannot establish Modal costs. A representative benchmark writes test records and incurs cloud usage, so none was silently launched as part of this read-only investigation.

The current `buffalo_l` model also needs separately confirmed commercial rights. The official provider distinguishes MIT code from commercially licensed model weights; no license price was found in the repository or public price list. Include the agreed license cost, or remeasure if a different model is chosen. [InsightFace licensing](https://www.insightface.ai/solutions/face-recognition-licensing).

## Reproduction and checks

Run `python3 docs/pricing-cost-model.py`. It uses the standard library, prints all cost tables, and makes no network calls. Tables were regenerated and checked against the saved analysis. Independent checks covered hourly resource arithmetic, decimal/binary transfer units, 30-to-90-day storage deltas, growing-index upload sums, shared allowances and payment contribution. This verifies the calculations under the assumptions; it does not verify production throughput or actual invoices.

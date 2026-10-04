# Infrastructure provider rates

Checked 3 October 2026 against the live, official pages linked below. These are public USD list rates, not verified account invoices or measured application costs. Contract discounts, taxes and account-specific legacy plans are unknown. Sources were retrieved on the date above; Cloudflare's R2 pricing page identifies its latest update as 1 October 2026.

## Modal

| Resource | Rate |
| --- | ---: |
| CPU | $0.0000131 / physical-core-second |
| RAM | $0.00000222 / GiB-second |
| T4 GPU | $0.000164 / second |
| L4 GPU | $0.000222 / second |
| A10 GPU | $0.000306 / second |

GPU charges are additional to CPU/RAM. A physical core is approximately two conventional vCPUs. Starter has no subscription charge and includes $30 of monthly compute credit per workspace. Team costs $250/month with $100 compute credit. These are standard Function prices, not the higher Sandbox prices. [Modal pricing](https://modal.com/pricing).

Application loading, processing, and retained warm-container time are billable; billing stops at scale-to-zero. CPU and RAM use the greater of the requested and consumed resources. Region selection and non-preemptible execution can add premiums; neither is requested in the local adapter. [Modal pricing](https://modal.com/pricing), [resource metering](https://modal.com/docs/guide/resources).

The local [Modal adapter](../python/modal_app.py) requests the following shapes. The derived hourly rates assume actual consumption does not exceed those requests:

| Function | Physical cores | GiB RAM | Derived $/second | Derived $/hour | Idle window | Max containers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ingestion | 1 | 4 | 0.00002198 | 0.079128 | 10 s | 1 |
| Search | 1 | 2 | 0.00001754 | 0.063144 | 60 s | 2 |
| HTTP gateway | 0.125 | 0.25 | 0.0000021925 | 0.007893 | 10 s | 2 |

For comparison, **2 physical cores + 2 GiB** would be $0.00003064/second, or $0.110304/hour. It is not the current search configuration. `cpu=1` already corresponds approximately to two vCPUs.

Charge each container's occupied interval once; concurrent inputs share that interval. Isolated searches can each incur initialization and warm retention, whereas a burst shares those costs. The HTTP gateway remains an additional container while awaiting synchronous search. None of these rates establishes seconds per photo or per search. The [handoff](modal-handoff.md) contains tiny smoke-test timings, not large-event benchmarks.

Egress billing began **1 October 2026**. Starter includes 1 TiB/workspace/billing-cycle, then $0.04/GiB; Team includes 10 TiB. Uploading processed photos or indexes from Modal to R2 consumes Modal egress. Downloading an index from R2 is principally Modal ingress, which is not charged as egress. Internal container-to-container traffic can count. Compute credits do not substitute for the separate egress allowance. [Network egress billing](https://modal.com/docs/guide/network-egress-billing), [billing](https://modal.com/docs/guide/billing).

## Cloudflare R2

| Item | Standard | Infrequent Access |
| --- | ---: | ---: |
| Storage / GB-month | $0.015 | $0.010 |
| Class A / million operations | $4.50 | $9.00 |
| Class B / million operations | $0.36 | $0.90 |
| Retrieval / GB | $0 | $0.01 |
| Internet egress | $0 | $0 |
| Minimum retention charged | None | 30 days |

Standard includes 10 GB-month, 1 million A and 10 million B operations monthly. IA has no free allowance. PUT, multipart operations and LIST are A; GET/HEAD are B; DELETE is free. Monthly storage averages daily peaks, including temporary archives. Usage rounds upward to whole GB-months and million-operation blocks. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

R2 distinguishes decimal GB (1,000,000,000 bytes) from binary GiB (1,073,741,824 bytes); use decimal GB for its published storage prices. [R2 units](https://developers.cloudflare.com/r2/platform/limits/).

For monthly Standard account totals, a direct translation of the published allowance and rounding rules is:

```text
storage = 0.015 × ceil(max(GB_month − 10, 0))
writes  = 4.50  × ceil(max(A_operations − 1_000_000, 0) / 1_000_000)
reads   = 0.36  × ceil(max(B_operations − 10_000_000, 0) / 1_000_000)
```

Customer marginal invoice cost is `bill(existing + customer) − bill(existing)`. Continuous per-operation allocation is useful for unit economics but differs from the rounded invoice. Apply free allowance once across the account, never per customer. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Cloudflare usage billing](https://developers.cloudflare.com/billing/understand/usage-based-billing/).

IA's storage saving is $0.005/GB-month, while one complete read costs $0.01/GB. Thus, before operation fees, reading more than half the stored bytes monthly removes the saving. A frequently reread face index is an especially poor IA candidate.

## Cloudflare Workers

Paid Standard is **$5/account/month**, including 10 million requests and 30 million CPU milliseconds. Overage is $0.30/million requests and $0.02/million CPU milliseconds. Free allows 100,000 requests/day and 10 ms CPU/invocation. Network waiting is not billed CPU; duration, bandwidth and egress carry no additional charge. Direct static-asset serving is free; dynamic execution remains metered. Workers Caching has a separately documented exception: cached requests still incur request charges. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Website and bot do not each require a separate $5 fee if they share the account. Count actual dynamic requests, not photos: direct R2 downloads and Modal inference have their own meters. Optional KV, Queues, Durable Objects, builds and observability can introduce separate costs if used. Workers Logs currently includes 20 million events/month on Paid, then $0.60/million; the documentation announces a pricing transition on 1 December 2026. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Convex

Free has hard caps; **Starter is $0/month plus usage**. Professional is $25/developer/month. Confirm the existing team's actual plan and region before estimating its invoice. [Plans](https://www.convex.dev/pricing).

| Meter | Starter included | Starter overage | Professional included | Professional overage |
| --- | ---: | ---: | ---: | ---: |
| Function calls/month | 1 million | $2.20/million | 25 million | $2/million |
| Database storage | 0.5 GB | $0.22/GB-month | 50 GB | $0.20/GB-month |
| Database I/O/month | 1 GB | $0.22/GB | 50 GB | $0.20/GB |
| Action compute/month | 20 GB-hours | $0.33/GB-hour | 250 GB-hours | $0.30/GB-hour |
| Data egress/month | 1 GB | $0.132/GB | 50 GB | $0.12/GB |
| File storage | 1 GB | $0.033/GB-month | 100 GB | $0.03/GB-month |
| Search storage | 0.5 GB | $0.55/GB-month | 1 GB | $0.50/GB-month |
| Search queries/month | 3,000 query-GB | $0.11/1,000 | 50,000 query-GB | $0.10/1,000 |

US-region rates; other regions cost 1.3×. Database storage includes indexes. Calls include scheduled executions and subscription updates. Convex-runtime actions use 64 MiB; Node actions use 512 MiB. [Resource rates](https://docs.convex.dev/production/state/limits). Included usage is shared across the entire team. [Pricing FAQ](https://www.convex.dev/pricing/faq).

Action-compute modeling should conservatively include elapsed execution, including waiting for Modal, on Starter/Professional. CPU-only action metering is specifically distinguished for Business/Enterprise. Validate actual `execution_time_ms` and `action_memory_used_mb` usage fields before calling this exact. A 30-second action at 64 MiB allocates approximately 0.000521 GB-hours under the usual 1,024 MiB/GB convention: about $0.000172 at Starter overage. This is an illustrative allocation, not an account measurement. [Usage metrics](https://docs.convex.dev/production/usage-limits), [billing attribution fields](https://docs.convex.dev/platform-apis/track-usage).

Search queries measure searches multiplied by index size; egress includes outgoing action traffic. [2026 billing changes](https://news.convex.dev/enterprise-launch/). These search/index rates are reference information only: the present app stores its face index in R2 and searches it in Python. Do not invent a Convex vector-search expense for that path. Metadata operations, reactive updates and Telegram delivery still use Convex.

## Lemon Squeezy

The standard platform fee is **5% + $0.50/order**, with additive surcharges of 1.5% for international transactions, 1.5% for PayPal and 0.5% for subscription payments. The percentage applies to the total paid, including tax. Non-US bank payouts add 1%; PayPal payouts are $0.50 in the US or 3% capped at $30 elsewhere. Actual merchant terms can differ. [Fees](https://docs.lemonsqueezy.com/help/getting-started/fees).

For a $19 tax-exclusive sale with 20% VAT and an international card, the fee is `0.50 + 0.065 × 22.80 = $1.982`; after remitting tax, proceeds are $17.018 before payout fees and infrastructure. Subscription pricing adds another 0.5% of the tax-inclusive order. Chargebacks, refunds, acquisition, support and tax on infrastructure are outside this provider-cost model.

## What remains unmeasured

An exact invoice needs actual retained image bytes, source archive lifetime, faces per image, index bytes, total billable container time and consumed resources, search timing/concurrency, metadata I/O, downloads, existing account usage, region and subscribed plans. Publish scenario estimates separately from provider rates and show assumptions explicitly. Never finance a permanent customer free tier by granting every customer the same shared provider credits.

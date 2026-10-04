"""Reproduce pricing scenarios: python3 docs/pricing-cost-model.py.

USD planning estimates, not invoice measurements. Rates checked 2026-10-03.
Sources and assumptions: pricing-cost-analysis.md, infrastructure-provider-rates.md.
Uses only Python's standard library; makes no network calls or external writes.
"""

from math import ceil

GB = 10**9
GIB = 2**30
INGEST_SECOND = 0.0000131 + 4 * 0.00000222
SEARCH_SECOND = 0.0000131 + 2 * 0.00000222
API_SECOND = 0.125 * 0.0000131 + 0.25 * 0.00000222


def estimate(photos, searches, days=30, photo_mb=5, seconds_per_photo=2,
             collection_limit=5000, cold_fraction=1, telegram_fraction=1):
    """A cohort uploaded once; searches are total across its retention period.

    Large cohorts are split into collection_limit-sized events. Timing, faces,
    metadata traffic, reads and session frequency are explicit assumptions.
    All photos are retained, avoiding reliance on the current no-face discard.
    """
    collections = [min(collection_limit, photos - offset)
                   for offset in range(0, photos, collection_limit)]
    # A 2 GB target leaves headroom under the real 2 GiB ZIP limit.
    batch_size = min(10_000, int(2000 / photo_mb))
    batches = sum(ceil(count / batch_size) for count in collections)
    photo_bytes = photos * photo_mb * 10**6
    # Two faces/photo, 12 kB JSON/face; JSON is rewritten after every archive.
    index_bytes = photos * 2 * 12_000
    index_upload_bytes = sum(
        min(end, count) * 2 * 12_000
        for count in collections
        for end in range(batch_size, count + batch_size, batch_size)
    )
    ingest_seconds = photos * seconds_per_photo + batches * 30
    # Includes index fetch, parse, scan, selfie inference and service requests.
    # This is a planning formula, NOT a measured scan throughput.
    search_active_seconds = 10 + max(collections) * 2 / 5000
    search_seconds = searches * (search_active_seconds + cold_fraction * 80)
    api_seconds = searches * (search_active_seconds + cold_fraction * 30) + batches * 15
    modal_compute = (ingest_seconds * INGEST_SECOND
                     + search_seconds * SEARCH_SECOND + api_seconds * API_SECOND)
    modal_egress_gib = (photo_bytes + index_upload_bytes) / GIB
    # Successful source ZIPs assumed to occupy R2 for one day before deletion.
    r2_gb_month = (photo_bytes + index_bytes) / GB * days / 30 + photo_bytes / GB / 30
    class_a = photos + 2 * batches
    class_b = 31 * searches + 2 * batches + 50 * len(collections)
    r2_storage = r2_gb_month * 0.015
    r2_operations = class_a * 4.5 / 10**6 + class_b * 0.36 / 10**6
    # Includes progress writes, subscription updates and search authorization.
    convex_calls = 3 * photos + 20 * searches + 20 * batches
    convex_io_gb = convex_calls * 10_000 / GB
    convex_egress_gb = searches * 0.5 * 10**6 * telegram_fraction / GB + convex_calls * 2000 / GB
    convex_db_gb = (searches * 5000 + batches * 5000 + len(collections) * 20_000) / GB
    # Telegram Node action waits for Modal, then delivers results; 512 MiB RAM.
    action_gbh = (searches * telegram_fraction * 0.5
                  * (search_active_seconds + 20 * cold_fraction + 10) / 3600
                  + batches * 0.0625 * 15 / 3600)
    convex = (convex_calls * 2.2 / 10**6 + convex_io_gb * 0.22
              + convex_egress_gb * 0.132 + action_gbh * 0.33
              + convex_db_gb * days / 30 * 0.22)
    worker_requests = 8 * searches + 50 * len(collections) + 4 * batches
    worker_cpu_ms = worker_requests * 20
    workers = worker_requests * 0.30 / 10**6 + worker_cpu_ms * 0.02 / 10**6
    gross = modal_compute + modal_egress_gib * 0.04 + r2_storage + r2_operations + convex + workers
    # Only valid as a single-month example, with otherwise unused allowances.
    cash_30d = None
    if days == 30:
        cash_30d = (5 + max(modal_compute - 30, 0)
                    + max(modal_egress_gib - 1024, 0) * 0.04
                    + ceil(max(r2_gb_month - 10, 0)) * 0.015
                    + ceil(max(class_a - 10**6, 0) / 10**6) * 4.5
                    + ceil(max(class_b - 10**7, 0) / 10**6) * 0.36
                    + max(convex_calls - 10**6, 0) * 2.2 / 10**6
                    + max(convex_io_gb - 1, 0) * 0.22
                    + max(convex_egress_gb - 1, 0) * 0.132
                    + max(action_gbh - 20, 0) * 0.33
                    + max(convex_db_gb - 0.5, 0) * 0.22
                    + max(worker_requests - 10**7, 0) * 0.30 / 10**6
                    + max(worker_cpu_ms - 30 * 10**6, 0) * 0.02 / 10**6)
    return dict(gross=gross, cash_30d=cash_30d, storage=r2_storage,
                modal_compute=modal_compute, modal_egress=modal_egress_gib * 0.04,
                r2_operations=r2_operations, convex=convex, workers=workers,
                ingest_hours=ingest_seconds / 3600,
                stored_gb=(photo_bytes + index_bytes) / GB,
                index_upload_gb=index_upload_bytes / GB)


def table(headers, rows):
    print('| ' + ' | '.join(headers) + ' |')
    print('| ' + ' | '.join('---' for _ in headers) + ' |')
    for row in rows:
        print('| ' + ' | '.join(str(value) for value in row) + ' |')


if __name__ == '__main__':
    print('Gross variable USD: 30 days, <=5,000 photos/collection; no shared credits or fixed fees')
    table(['Photos', '100 searches', '1,000 searches', '5,000 searches'], [
        [f'{n:,}'] + [f"{estimate(n, s)['gross']:.2f}" for s in [100, 1000, 5000]]
        for n in [100, 1000, 5000, 20_000, 100_000, 300_000, 500_000]])
    print('\nRetention and account illustration: 1,000 searches total')
    table(['Photos', '30-day gross', '90-day gross', '30-day account cash', 'Ingest hours'], [
        [f'{n:,}', f"{estimate(n,1000)['gross']:.2f}",
         f"{estimate(n,1000,90)['gross']:.2f}",
         f"{estimate(n,1000)['cash_30d']:.2f}",
         f"{estimate(n,1000)['ingest_hours']:.1f}"]
        for n in [1000, 5000, 20_000, 100_000, 300_000, 500_000]])
    print('\nBreakdown: 100,000 photos, 1,000 searches, 30 days')
    print(estimate(100_000, 1000))
    print('\nEvent candidates: gross includes full photo/byte quota, before fees and overhead')
    table(['Price', 'Photos', 'Days', 'Searches', 'Gross', 'After 6.5% + $0.50 fee'], [
        [price, n, days, s, f'{cost:.2f}', f'{price - price * .065 - .5 - cost:.2f}']
        for price, n, days, s in [(19,1000,30,300),(49,5000,90,1000),(149,20_000,90,5000)]
        for cost in [estimate(n,s,days,collection_limit=n)['gross']]])
    print('\nSensitivity: 100,000 photos, 1,000 searches, 30 days')
    table(['Photo MB', '0.5 seconds/photo', '2 seconds/photo', '5 seconds/photo'], [
        [mb] + [f"{estimate(100_000,1000,photo_mb=mb,seconds_per_photo=t)['gross']:.2f}"
                for t in [.5,2,5]] for mb in [2,5,15]])
    print('\nFree demo: 100 photos, 20 searches, seven days')
    print(estimate(100,20,7)['gross'])

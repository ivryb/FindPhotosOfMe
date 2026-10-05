import type { H3Event } from "h3";

/**
 * The response this edge location cached under `key`, or a new one from `make`, which is then cached for next time.
 * Only Workers have an edge cache (caches.default); development and tests make the response every time.
 */
export async function cachedAtEdge(event: H3Event, key: Request, make: () => Promise<Response>) {
  const cache = typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default;
  const cached = await cache?.match(key);
  if (cached) return cached;
  const response = await make();
  if (cache) event.waitUntil(cache.put(key, response.clone()));
  return response;
}

// Serves a photo or thumbnail from R2 for a signed link (see server/utils/media.ts), through Cloudflare's
// edge cache: the first view in a region reads R2, later ones come from the cache.

export default defineEventHandler(async (event) => {
  const key = decodeURIComponent(getRouterParam(event, "key") ?? "");
  const { d, s, g, download } = getQuery(event);
  const link = { day: Number(d), signature: s, gallery: g === "1", download: download === "1" };
  if (!key || !(await isSignedMediaLink(event, key, link))) {
    throw createError({ statusCode: 403, statusMessage: "This link has expired" });
  }

  // Only Workers have the edge cache (caches.default); development and tests read R2 every time.
  const cache = typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default;
  const request = toWebRequest(event);
  const cached = await cache?.match(request);
  if (cached) return cached;

  const photo = await readPhoto(event, key);
  if (!photo) throw createError({ statusCode: 404, statusMessage: "Photo not found" });
  const name = key.slice(key.lastIndexOf("/") + 1);
  const response = new Response(photo.stream, {
    headers: {
      "content-type": photo.contentType,
      ...(photo.contentLength ? { "content-length": String(photo.contentLength) } : {}),
      // Links change every day, so a copy never outlives the link that fetched it.
      "cache-control": "public, max-age=172800, immutable",
      ...(link.download ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } : {}),
    },
  });
  if (cache) event.waitUntil(cache.put(request, response.clone()));
  return response;
});

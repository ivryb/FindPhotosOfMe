import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

// Access is checked before the edge cache so unpublishing also closes already cached photos.

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  const key = getRouterParam(event, "key", { decode: true }) ?? "";
  const { download, requestId } = getQuery(event);
  if (requestId !== undefined && typeof requestId !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Invalid search request" });
  }
  const args = { key, requestId };
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  let allowed = await convex.query(api.collections.canReadPhoto, args);
  const bearer = getHeader(event, "authorization")?.startsWith("Bearer ");
  if (!allowed && (bearer || getHeader(event, "cookie"))) {
    const client = bearer ? getAuthenticatedConvex(event) : await getCookieAuthenticatedConvex(event);
    allowed = await client.query(api.collections.canReadPhoto, args);
  }
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: "Photo access denied" });
  }

  // Only Workers have the edge cache (caches.default); development and tests read R2 every time.
  const cache = typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default;
  // The cache holds only bytes; different search requests and downloads reuse the same copy after authorization.
  const url = getRequestURL(event);
  url.search = "";
  const request = new Request(url);
  let response = await cache?.match(request);
  if (!response) {
    const photo = await readPhoto(event, key);
    if (!photo) throw createError({ statusCode: 404, statusMessage: "Photo not found" });
    response = new Response(photo.stream, {
      headers: {
        "content-type": photo.contentType,
        ...(photo.contentLength ? { "content-length": String(photo.contentLength) } : {}),
        ...(photo.etag ? { etag: photo.etag } : {}),
        "cache-control": "public, max-age=172800",
      },
    });
    if (cache) event.waitUntil(cache.put(request, response.clone()));
  }

  // Browsers can keep bytes but must recheck access after unpublishing or signing out, including for a 304.
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-cache");
  if (download === "1") {
    const name = key.slice(key.lastIndexOf("/") + 1);
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  const etag = headers.get("etag");
  if (etag && getHeader(event, "if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(response.body, { headers });
});

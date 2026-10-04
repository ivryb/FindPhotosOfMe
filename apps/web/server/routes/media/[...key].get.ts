import type { H3Event } from "h3";

// Serves a photo or thumbnail from R2 for a signed link (see server/utils/media.ts), through Cloudflare's
// edge cache: the first view in a region reads R2, later ones come from the cache.

type Photo = { stream: ReadableStream; contentType: string; contentLength?: number };
type Bucket = { get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null> };

export default defineEventHandler(async (event) => {
  const key = decodeURIComponent(getRouterParam(event, "key") ?? "");
  const { d, s, download } = getQuery(event);
  const wantsDownload = download === "1";
  if (!key || typeof s !== "string" || !(await isSignedMediaLink(event, key, Number(d), s, wantsDownload))) {
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
      ...(wantsDownload ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } : {}),
    },
  });
  if (cache) event.waitUntil(cache.put(request, response.clone()));
  return response;
});

/** On Workers through the PHOTOS binding (wrangler.jsonc); development and tests read through R2's S3 API. */
async function readPhoto(event: H3Event, key: string): Promise<Photo | undefined> {
  const bucket: Bucket | undefined = event.context.cloudflare?.env?.PHOTOS;
  if (!bucket) return useR2(event).getObjectStream(key).catch(() => undefined);
  const object = await bucket.get(key);
  return object ? { stream: object.body, contentType: object.httpMetadata?.contentType ?? "application/octet-stream", contentLength: object.size } : undefined;
}

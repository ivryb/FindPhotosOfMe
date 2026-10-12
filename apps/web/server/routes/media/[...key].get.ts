import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { isVideoFile } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { ConvexHttpClient } from "convex/browser";

// Access is checked before the edge cache so unpublishing also closes already cached photos.

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  const key = getRouterParam(event, "key", { decode: true }) ?? "";
  const { download, requestId, shareToken } = getQuery(event);
  if (requestId !== undefined && typeof requestId !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Invalid search request" });
  }
  if (shareToken !== undefined && typeof shareToken !== "string") throw createError({ statusCode: 400, statusMessage: "Invalid gallery link" });
  setResponseHeader(event, "x-robots-tag", "noindex, nofollow, noarchive");
  const args = { key, requestId, shareToken };
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

  const read = async (range?: ByteRange) => {
    const photo = await readPhoto(event, key, range);
    if (!photo) throw createError({ statusCode: 404, statusMessage: "Photo not found" });
    const { start, end, size } = photo.range ?? {};
    return new Response(photo.stream, {
      status: photo.range ? 206 : 200,
      headers: {
        "content-type": photo.contentType,
        ...(photo.contentLength ? { "content-length": String(photo.contentLength) } : {}),
        ...(photo.range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
        ...(photo.etag ? { etag: photo.etag } : {}),
        "cache-control": "public, max-age=172800",
      },
    });
  };
  // Video players ask for parts of a video, which come straight from R2. Whole videos skip the edge cache too: copying
  // one into it would hold up to 500 MB in the Worker's memory. Their posters are cached like photos.
  const range = byteRange(getHeader(event, "range"));
  const video = isVideoFile(key);
  // The cache holds only bytes; different search requests and downloads reuse the same copy after authorization.
  const url = getRequestURL(event);
  url.search = "";
  const response = range || video ? await read(range) : await cachedAtEdge(event, new Request(url), () => read());

  // Every recheck waits on Convex, so browsers reuse a photo for ten minutes and going back to one is instant.
  // Unpublishing or signing out reaches photos a browser already holds once those minutes pass.
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, max-age=600");
  headers.set("accept-ranges", "bytes");
  if (download === "1") {
    const name = key.slice(key.lastIndexOf("/") + 1);
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  const etag = headers.get("etag");
  if (etag && response.status === 200 && getHeader(event, "if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(response.body, { status: response.status, headers });
});

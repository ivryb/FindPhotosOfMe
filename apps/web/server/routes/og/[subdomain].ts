import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { resizedKey } from "@FindPhotosOfMe/backend/convex/photoKeys";

/**
 * A public gallery's link preview image (see renderGalleryCard), drawn from its first previews' thumbnails.
 * The edge cache keys each image by what it shows, so renaming a gallery or adding photos shows at once,
 * and unpublishing stops serving it.
 */
export default defineEventHandler(async (event) => {
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  const gallery = await convex.query(api.collections.getPublicBySubdomain, { subdomain: getRouterParam(event, "subdomain") ?? "" });
  const keys = gallery?.previewImages.slice(0, 5).map((key) => resizedKey(key, "thumbs")) ?? [];
  if (!gallery || !keys.length) throw createError({ statusCode: 404, statusMessage: "This gallery isn’t online" });

  const shown = getRequestURL(event);
  shown.search = new URLSearchParams({ title: gallery.title, count: String(gallery.imagesCount), photos: keys.join() }).toString();
  return cachedAtEdge(event, new Request(shown), async () => {
    const read = await Promise.all(keys.map(async (key) => {
      const photo = await readPhoto(event, key);
      return photo && { key, data: await new Response(photo.stream).arrayBuffer() };
    }));
    const photos = read.filter((photo) => photo !== undefined);
    if (!photos.length) throw createError({ statusCode: 404, statusMessage: "Gallery photos not found" });
    const jpeg = await renderGalleryCard({ title: gallery.title, count: gallery.imagesCount, photos });
    return new Response(jpeg, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
  });
});

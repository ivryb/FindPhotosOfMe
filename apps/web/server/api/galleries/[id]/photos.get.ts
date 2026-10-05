import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import type { GalleryPhotos } from "#shared/types/gallery";
import { ConvexHttpClient } from "convex/browser";

/**
 * Every photo a public gallery's visitors may browse, in one response, so the page can show any part of the
 * gallery at once. Galleries that show only previews return just those.
 */
export default defineEventHandler(async (event): Promise<GalleryPhotos> => {
  const id = getRouterParam(event, "id") as Id<"collections">;
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  // The listing runs alongside the gallery check to save a round trip; only browsable galleries return it.
  const [gallery, keys] = await Promise.all([
    convex.query(api.collections.getPublic, { id }).catch(() => null),
    listFolder(event, `${id}/`),
  ]);
  if (!gallery) throw createError({ statusCode: 404, statusMessage: "Gallery not found" });
  setHeader(event, "cache-control", "private, no-store");

  if (!gallery.showAllPhotos) return { photos: await Promise.all(gallery.previewImages.map((key) => photoLinks(event, key))) };
  return { keys: keys.filter(isGalleryPhoto), ...(await galleryLinks(event, gallery._id)) };
});

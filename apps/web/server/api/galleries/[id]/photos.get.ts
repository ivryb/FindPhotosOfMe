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
  const authorization = getHeader(event, "authorization");
  if (authorization?.startsWith("Bearer ")) convex.setAuth(authorization.slice(7));
  const owned = authorization ? await convex.query(api.collections.get, { id }).catch(() => null) : null;
  const gallery = owned ?? await convex.query(api.collections.getPublic, { id });
  if (!gallery) throw createError({ statusCode: 404, statusMessage: "Gallery not found" });
  setHeader(event, "cache-control", "private, no-store");

  if (!owned && gallery.showAllPhotos === false) return { photos: await Promise.all((gallery.previewImages ?? []).map((key) => photoLinks(event, key))) };
  const keys = await listFolder(event, `${id}/`);
  return { keys: keys.filter(isGalleryPhoto), ...(await galleryLinks(event, gallery._id)) };
});

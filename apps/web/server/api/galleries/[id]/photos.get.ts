import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import type { GalleryPhotos } from "#shared/types/gallery";
import { ConvexHttpClient } from "convex/browser";
import { isGalleryPhoto } from "@FindPhotosOfMe/backend/convex/photoKeys";

/**
 * Every photo a public gallery's visitors may browse, in one response, so the page can show any part of the
 * gallery at once. Galleries that show only previews return just those.
 */
export default defineEventHandler(async (event): Promise<GalleryPhotos> => {
  const id = getRouterParam(event, "id") as Id<"collections">;
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  const { shareToken } = getQuery(event);
  if (shareToken !== undefined && typeof shareToken !== "string") throw createError({ statusCode: 400, statusMessage: "Invalid gallery link" });
  const authorization = getHeader(event, "authorization");
  if (authorization?.startsWith("Bearer ")) convex.setAuth(authorization.slice(7));
  const owned = authorization ? await convex.query(api.collections.get, { id }).catch(() => null) : null;
  const gallery = owned ?? await convex.query(api.collections.getPublic, { id, shareToken });
  if (!gallery) throw createError({ statusCode: 404, statusMessage: "Gallery not found" });
  setHeader(event, "cache-control", "private, no-store");

  if (!owned && gallery.showAllPhotos === false) return { keys: gallery.previewImages ?? [] };
  const keys = await listFolder(event, `${id}/`);
  return { keys: keys.filter(isGalleryPhoto) };
});

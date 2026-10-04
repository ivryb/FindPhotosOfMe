import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import type { GalleryPage } from "#shared/types/gallery";
import { ConvexHttpClient } from "convex/browser";

const PAGE_SIZE = 60;

/** A page of a public gallery's photos. Galleries that show only previews return them as a single page. */
export default defineEventHandler(async (event): Promise<GalleryPage> => {
  const id = getRouterParam(event, "id") as Id<"collections">;
  const after = getQuery(event).after;
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  const gallery = await convex.query(api.collections.getPublic, { id }).catch(() => null);
  if (!gallery) throw createError({ statusCode: 404, statusMessage: "Gallery not found" });

  const r2 = useR2(event);
  const { keys, next } = gallery.showAllPhotos
    ? await r2.listPhotos(gallery._id, typeof after === "string" ? after : undefined, PAGE_SIZE)
    : { keys: gallery.previewImages, next: null };
  setHeader(event, "cache-control", "private, no-store");
  return { photos: await Promise.all(keys.map((key) => photoLinks(event, key))), next };
});

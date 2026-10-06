import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { BATCH_PHOTOS, MAX_PHOTO_BYTES, PHOTO_NAME, photoType, stagingKey } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

type Body = Partial<FunctionArgs<typeof api.uploads.prepareBatch>>;

/** Links for the browser to put a batch of photos in the gallery's upload area, where workers pick them up. */
export default defineEventHandler(async (event) => {
  const { uploadId, first, photos, access } = (await readBody<Body>(event)) ?? {};
  if (typeof uploadId !== "string" || !uploadId || typeof first !== "number" || !Number.isInteger(first) || first < 0
    || !Array.isArray(photos) || !photos.length || photos.length > BATCH_PHOTOS
    || !photos.every((photo) => photo && typeof photo.name === "string" && PHOTO_NAME.test(photo.name)
      && Number.isInteger(photo.size) && photo.size >= 0 && photo.size <= MAX_PHOTO_BYTES)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid photos" });
  }
  // A refused upload (the gallery is offline or refunded) comes back as a ConvexError meant for people.
  const convex = access ? new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl) : getAuthenticatedConvex(event);
  const { batchId, collectionId, expiresAt } = await convex.mutation(api.uploads.prepareBatch, { uploadId, first, photos, access }).catch((error) => {
    if (error instanceof ConvexError) throw createError({ statusCode: 409, statusMessage: String(error.data) });
    throw error;
  });

  const r2 = useR2(event);
  const urls = await Promise.all(photos.map(({ name, size }) =>
    r2.getUploadSignedUrl({ key: stagingKey(collectionId, batchId, name), contentType: photoType(name), size, expiresAt })));
  setHeader(event, "Cache-Control", "private, no-store");
  return { batchId, urls };
});

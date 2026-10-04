import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { BATCH_PHOTOS, PHOTO_NAME, photoType, stagingKey } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { ConvexError } from "convex/values";

type Body = { collectionId?: string; uploadId?: string; names?: string[] };

/** Links for the browser to put a batch of photos in the gallery's upload area, where workers pick them up. */
export default defineEventHandler(async (event) => {
  const { collectionId, uploadId, names } = (await readBody<Body>(event)) ?? {};
  if (!collectionId || !uploadId || !Array.isArray(names) || !names.length || names.length > BATCH_PHOTOS
    || !names.every((name) => typeof name === "string" && PHOTO_NAME.test(name))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid photos" });
  }
  // A refused upload (the gallery is offline or refunded) comes back as a ConvexError meant for people.
  await getAuthenticatedConvex(event).query(api.collections.canUpload, { id: collectionId as Id<"collections"> }).catch((error) => {
    if (error instanceof ConvexError) throw createError({ statusCode: 409, statusMessage: String(error.data) });
    throw error;
  });

  const r2 = useR2(event);
  const urls = await Promise.all(names.map((name) =>
    r2.getUploadSignedUrl(stagingKey(collectionId, uploadId, name), photoType(name), 3600)));
  return { urls };
});

import { ConvexHttpClient } from "convex/browser";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default defineEventHandler(async (event) => {
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  const config = useRuntimeConfig(event);
  if (!config.pythonApiUrl || !config.serviceToken) {
    throw createError({ statusCode: 500, statusMessage: "Face search is not configured" });
  }
  const parts = await readMultipartFormData(event);
  const collectionId = parts?.find((part) => part.name === "collection_id")?.data.toString();
  const photo = parts?.find((part) => part.name === "reference_photo");
  if (!collectionId || !photo?.data || !photo.type || !PHOTO_TYPES.has(photo.type)) {
    throw createError({ statusCode: 400, statusMessage: "A JPEG, PNG, or WebP photo is required" });
  }
  if (photo.data.length > MAX_PHOTO_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Photo must be 10 MB or smaller" });
  }

  const requestId = await convex.mutation(api.searchRequests.create, { collectionId: collectionId as any });

  const body = new FormData();
  body.append("search_request_id", requestId);
  body.append(
    "reference_photo",
    new Blob([new Uint8Array(photo.data)], { type: photo.type }),
    photo.filename || "photo.jpg"
  );
  const response = await fetch(`${config.pythonApiUrl}/api/search-photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.serviceToken}` },
    body,
  });
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: "Face search service failed to start" });
  }
  return { requestId };
});

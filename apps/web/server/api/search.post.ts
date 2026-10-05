import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default defineEventHandler(async (event) => {
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  const authorization = getHeader(event, "authorization");
  if (authorization?.startsWith("Bearer ")) convex.setAuth(authorization.slice(7));
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

  // A refused search (no photos yet, or the owner's balance is empty) comes back as a ConvexError meant for people.
  const requestId = await convex.mutation(api.searchRequests.create, { collectionId: collectionId as Id<"collections"> })
    .catch((error) => {
      if (error instanceof ConvexError) throw createError({ statusCode: 409, statusMessage: String(error.data) });
      throw error;
    });

  const body = new FormData();
  body.append("search_request_id", requestId);
  body.append(
    "reference_photo",
    new Blob([new Uint8Array(photo.data)], { type: photo.type }),
    photo.filename || "photo.jpg"
  );
  // The search service records every outcome on the request, including why it failed, and the page reads it there.
  // When the service can't be reached (such as a failed cold start), the request is failed here so the owner gets the search back.
  const response = await fetch(`${config.pythonApiUrl}/api/search-photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.serviceToken}` },
    body,
  }).catch(() => undefined);
  if (!response?.ok) {
    await convex.mutation(api.searchRequests.updateForService, { id: requestId, serviceToken: config.serviceToken, status: "error", error: "failed" });
  }
  return { requestId };
});

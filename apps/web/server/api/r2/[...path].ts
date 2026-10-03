import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, "path");
  if (!path) throw createError({ statusCode: 400, statusMessage: "Missing path" });
  const key = decodeURIComponent(path);

  const config = useRuntimeConfig(event);
  const convex = new ConvexHttpClient(config.public.convexUrl);
  const allowed = await convex.query(api.collections.isPublicPreview, { key });
  if (!allowed) throw createError({ statusCode: 404, statusMessage: "Object not found" });

  const { stream, contentType, contentLength, lastModified } = await useR2(event).getObjectStream(key);
  setHeader(event, "content-type", contentType);
  if (contentLength) setHeader(event, "content-length", contentLength);
  if (lastModified) setHeader(event, "last-modified", lastModified.toUTCString());
  setHeader(event, "cache-control", "public, max-age=3600");
  return sendStream(event, stream);
});

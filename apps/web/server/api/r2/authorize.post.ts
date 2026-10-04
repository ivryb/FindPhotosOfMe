import { ConvexHttpClient } from "convex/browser";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

export default defineEventHandler(async (event) => {
  const convex = new ConvexHttpClient(useRuntimeConfig(event).public.convexUrl);
  // Keep access to older signed-in searches while new searches work anonymously.
  const authorization = getHeader(event, "authorization");
  if (authorization?.startsWith("Bearer ")) convex.setAuth(authorization.slice(7));
  const body = await readBody<{ requestId?: string; keys?: string[] }>(event);
  if (!body.requestId || !Array.isArray(body.keys)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid request" });
  }
  const allowed = await convex.query(api.searchRequests.authorizeImages, {
    id: body.requestId as Id<"searchRequests">,
    keys: body.keys,
  });
  // The query returns false for keys outside this search; it does not throw.
  if (!allowed) throw createError({ statusCode: 403, statusMessage: "Photo access denied" });
  return { photos: await Promise.all(body.keys.map((key) => photoLinks(event, key))) };
});

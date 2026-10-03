import type { H3Event } from "h3";
import { ConvexHttpClient } from "convex/browser";

export function getAuthenticatedConvex(event: H3Event) {
  const authorization = getHeader(event, "authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  }

  const url = useRuntimeConfig(event).public.convexUrl;
  if (!url) throw createError({ statusCode: 500, statusMessage: "Convex is not configured" });
  const client = new ConvexHttpClient(url);
  client.setAuth(authorization.slice(7));
  return client;
}

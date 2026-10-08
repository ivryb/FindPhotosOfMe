import type { H3Event } from "h3";
import { ConvexHttpClient } from "convex/browser";

export function getAuthenticatedConvex(event: H3Event) {
  // Anything not shaped like a JWT is refused here. Older tabs sent "Bearer null" when their token request failed,
  // which Convex rejected and these routes answered with a bare 500.
  const token = getHeader(event, "authorization")?.match(/^Bearer ([^.\s]+\.[^.\s]+\.[^.\s]+)$/)?.[1];
  if (!token) throw createError({ statusCode: 401, statusMessage: "Sign in required" });

  const url = useRuntimeConfig(event).public.convexUrl;
  if (!url) throw createError({ statusCode: 500, statusMessage: "Convex is not configured" });
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}

export async function getCookieAuthenticatedConvex(event: H3Event) {
  setResponseHeader(event, "cache-control", "private, no-store");
  const config = useRuntimeConfig(event);
  const response = await fetch(`${config.public.convexSiteUrl}/api/auth/convex/token`, {
    headers: { cookie: getHeader(event, "cookie") ?? "" },
  });
  for (const cookie of response.headers.getSetCookie()) appendResponseHeader(event, "set-cookie", cookie);
  if (response.status === 401) throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: "Could not verify session" });
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("token" in data) || typeof data.token !== "string") {
    throw createError({ statusCode: 401, statusMessage: "Sign in required" });
  }
  const client = new ConvexHttpClient(config.public.convexUrl);
  client.setAuth(data.token);
  return client;
}

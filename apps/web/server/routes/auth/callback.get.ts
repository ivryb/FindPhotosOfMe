import { authRedirect } from "#shared/utils/authRedirect";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  setResponseHeader(event, "referrer-policy", "no-referrer");
  const { ott, state, redirect } = getQuery(event);
  if (typeof ott !== "string" || typeof state !== "string" || state !== getCookie(event, "auth-callback-state")) {
    throw createError({ statusCode: 400, statusMessage: "Invalid sign-in callback. Please sign in again." });
  }
  deleteCookie(event, "auth-callback-state", { path: "/auth/callback" });
  const response = await fetch(`${useRuntimeConfig(event).public.convexSiteUrl}/api/auth/cross-domain/one-time-token/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: getRequestURL(event).origin },
    body: JSON.stringify({ token: ott }),
    redirect: "manual",
  });
  if (!response.ok) {
    throw createError({ statusCode: 401, statusMessage: "Sign-in expired. Please sign in again." });
  }
  for (const cookie of response.headers.getSetCookie()) appendResponseHeader(event, "set-cookie", cookie);
  return sendRedirect(event, authRedirect(redirect));
});

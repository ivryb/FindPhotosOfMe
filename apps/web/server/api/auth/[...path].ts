import { authRedirect } from "#shared/utils/authRedirect";

export default defineEventHandler(async (event) => {
  // Cookie-authenticated writes must originate from this app, including logout.
  if (event.method !== "GET" && getHeader(event, "origin") !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: "Invalid origin" });
  }
  const headers = new Headers();
  for (const name of ["cookie", "content-type", "origin", "accept"]) {
    const value = getHeader(event, name);
    if (value) headers.set(name, value);
  }
  let body = event.method === "GET" ? undefined : await readRawBody(event);
  if (event.path === "/api/auth/sign-in/social" && event.method === "POST") {
    const params: unknown = await readBody(event);
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid sign-in request" });
    }
    const callback = new URL("/auth/callback", getRequestURL(event).origin);
    const requestedCallback = new URL(
      "callbackURL" in params && typeof params.callbackURL === "string" ? params.callbackURL : "/auth/callback",
      callback.origin,
    );
    callback.searchParams.set("redirect", authRedirect(requestedCallback.searchParams.get("redirect")));
    const state = crypto.randomUUID();
    callback.searchParams.set("state", state);
    // Bind the cross-domain handoff to the browser that started sign-in.
    setCookie(event, "auth-callback-state", state, {
      httpOnly: true, secure: callback.protocol === "https:", sameSite: "lax", path: "/auth/callback", maxAge: 600,
    });
    body = JSON.stringify({ ...params, callbackURL: callback.href, newUserCallbackURL: callback.href });
  }
  const response = await fetch(`${useRuntimeConfig(event).public.convexSiteUrl}${event.path}`, {
    method: event.method,
    headers,
    body,
    redirect: "manual",
  });
  const responseHeaders = new Headers(response.headers);
  // Fetch decodes compressed responses; their original length/encoding no longer apply.
  for (const name of ["content-encoding", "content-length", "transfer-encoding"]) responseHeaders.delete(name);
  responseHeaders.set("cache-control", "private, no-store");
  return sendWebResponse(event, new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  }));
});

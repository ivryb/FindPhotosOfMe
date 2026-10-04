import { afterAll, beforeAll, expect, test } from "bun:test";

import { startApp } from "./app";
import { sessionCookie, ownerJwt } from "./backend";

const origin = "http://localhost:3212";
let app: Awaited<ReturnType<typeof startApp>>;

beforeAll(async () => {
  app = await startApp(3212);
}, 90000);

afterAll(() => app?.stop());

test("email sign-in sets an HttpOnly session cookie on the app origin", async () => {
  const response = await fetch(`${origin}/api/auth/sign-in/email-otp`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com", otp: "123456" }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.getSetCookie()).toContain(`${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

test("logout expires the cookie and cross-origin writes are rejected", async () => {
  const response = await fetch(`${origin}/api/auth/sign-out`, {
    method: "POST", headers: { origin, cookie: sessionCookie },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  const forbidden = await fetch(`${origin}/api/auth/sign-out`, {
    method: "POST", headers: { origin: "https://attacker.example", cookie: sessionCookie },
  });
  expect(forbidden.status).toBe(403);
});

test("Google callback sets the app cookie and returns to a local page only in the initiating browser", async () => {
  const start = await fetch(`${origin}/api/auth/sign-in/social`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/auth/callback?redirect=/admin/collections/itarena` }),
  });
  const { url } = await start.json();
  const callback = new URL(url);
  callback.searchParams.set("ott", "valid-once");
  const unbound = await fetch(callback, { redirect: "manual" });
  expect(unbound.status).toBe(400);
  const result = await fetch(callback, {
    redirect: "manual", headers: { cookie: start.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") },
  });
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe("/admin/collections/itarena");
  expect(result.headers.get("set-cookie")).toContain(sessionCookie);
  expect(result.headers.get("cache-control")).toContain("no-store");
});

for (const page of ["/admin", "/admin/collections/itarena"]) {
  test(`${page} redirects anonymous requests before rendering private content`, async () => {
    const response = await fetch(`${origin}${page}`, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in?redirect=");
    expect(await response.text()).not.toContain("Owner-only description");
  });
  test(`${page} includes the owner's collections in initial HTML`, async () => {
    const response = await fetch(`${origin}${page}`, { headers: { cookie: sessionCookie } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const html = await response.text();
    expect(html).toContain("IT Arena SSR fixture");
    expect(html).not.toContain("No collections yet.");
    expect(html).not.toContain(ownerJwt);
    expect(html).not.toContain("test-session");
  });
}

test("expired sessions redirect and a different owner's detail never appears in HTML", async () => {
  const expired = await fetch(`${origin}/admin`, {
    redirect: "manual", headers: { cookie: "__Secure-better-auth.session_token=expired" },
  });
  expect(expired.status).toBe(302);
  const forbidden = await fetch(`${origin}/admin/collections/other-owner`, { headers: { cookie: sessionCookie } });
  expect(forbidden.status).toBeGreaterThanOrEqual(400);
  const apiResponse = await fetch(`${origin}/api/admin/collections/other-owner`, { headers: { cookie: sessionCookie } });
  expect(apiResponse.status).toBeGreaterThanOrEqual(400);
  expect(await apiResponse.text()).not.toContain("Owner-only description");
  expect(await forbidden.text()).not.toContain("Owner-only description");
  const missing = await fetch(`${origin}/admin/collections/missing`, { headers: { cookie: sessionCookie } });
  expect(await missing.text()).toContain("collection Not Found");
});

test("callback rejects expired handoffs and external redirect destinations", async () => {
  const start = await fetch(`${origin}/api/auth/sign-in/social`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/auth/callback?redirect=//attacker.example` }),
  });
  const { url } = await start.json();
  const callback = new URL(url);
  const cookie = start.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  callback.searchParams.set("ott", "expired");
  const expired = await fetch(callback, { redirect: "manual", headers: { cookie } });
  expect(expired.status).toBe(401);
  callback.searchParams.set("ott", "valid-once");
  const result = await fetch(callback, { redirect: "manual", headers: { cookie } });
  expect(result.headers.get("location")).toBe("/admin");
});


test("attendees can open a gallery and start a search without signing in", async () => {
  const page = await fetch(`${origin}/search?subdomain=itarena`);
  expect(page.status).toBe(200);
  const html = await page.text();
  expect(html).toContain("IT Arena SSR fixture");
  expect(html).toContain("Find photos with you");
  expect(html).not.toContain("Sign in first");
  const body = new FormData();
  body.append("collection_id", "test-collection");
  body.append("reference_photo", new Blob(["fixture-image"], { type: "image/jpeg" }), "selfie.jpg");
  const response = await fetch(`${origin}/api/search`, { method: "POST", body });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ requestId: "fixture-search" });
});

test("a search the gallery owner can't pay for is refused with a readable reason", async () => {
  const body = new FormData();
  body.append("collection_id", "paused-collection");
  body.append("reference_photo", new Blob(["fixture-image"], { type: "image/jpeg" }), "selfie.jpg");
  const response = await fetch(`${origin}/api/search`, { method: "POST", body });
  expect(response.status).toBe(409);
  expect((await response.json()).statusMessage).toBe("Searching is paused for this gallery. Please ask its owner to top up.");
});

test("anonymous result downloads only authorize photos from that search", async () => {
  const authorize = (keys: string[]) => fetch(`${origin}/api/r2/authorize`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId: "fixture-search", keys }),
  });
  const result = await authorize(["test-collection/photo-007.jpg"]);
  expect(result.status).toBe(200);
  const [photo] = (await result.json()).photos;
  expect(photo.full).toContain("test-collection/photo-007.jpg");
  expect(photo.thumb).toContain("test-collection/thumbs/photo-007.jpg");
  expect(photo.download).toContain("attachment");
  expect((await authorize(["test-collection/photo-008.jpg"])).status).toBe(403);
});

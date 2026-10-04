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
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/auth/callback?redirect=/admin/galleries/itarena` }),
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
  expect(result.headers.get("location")).toBe("/admin/galleries/itarena");
  expect(result.headers.get("set-cookie")).toContain(sessionCookie);
  expect(result.headers.get("cache-control")).toContain("no-store");
});

for (const page of ["/admin", "/admin/galleries/itarena"]) {
  test(`${page} redirects anonymous requests before rendering private content`, async () => {
    const response = await fetch(`${origin}${page}`, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in?redirect=");
    expect(await response.text()).not.toContain("Owner-only description");
  });
}

test("the dashboard opens the owner's newest gallery, and old collection links still work", async () => {
  const front = await fetch(`${origin}/admin`, { redirect: "manual", headers: { cookie: sessionCookie } });
  expect(front.status).toBe(302);
  expect(front.headers.get("location")).toBe("/admin/galleries/itarena");
  const old = await fetch(`${origin}/admin/collections/itarena`, { redirect: "manual" });
  expect(old.headers.get("location")).toBe("/admin/galleries/itarena");
});

test("a gallery's dashboard includes the owner's galleries and balance in initial HTML", async () => {
  const response = await fetch(`${origin}/admin/galleries/itarena`, { headers: { cookie: sessionCookie } });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const html = await response.text();
  expect(html).toContain("IT Arena SSR fixture");
  expect(html).toContain("$3.25");
  expect(html).not.toContain(ownerJwt);
  expect(html).not.toContain("test-session");
});

test("expired sessions redirect, and galleries the owner doesn't have are not found", async () => {
  const expired = await fetch(`${origin}/admin`, {
    redirect: "manual", headers: { cookie: "__Secure-better-auth.session_token=expired" },
  });
  expect(expired.status).toBe(302);
  const missing = await fetch(`${origin}/admin/galleries/other-owner`, { headers: { cookie: sessionCookie } });
  expect(missing.status).toBe(404);
  expect(await missing.text()).toContain("Gallery not found");
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
  const download = await fetch(`${origin}${photo.download}`);
  expect(download.headers.get("content-disposition")).toContain("attachment");
  expect((await authorize(["test-collection/photo-008.jpg"])).status).toBe(403);
});

test("upload links are signed only for the gallery owner, for plain photo names in the gallery's upload area", async () => {
  const sign = (body: object, signedIn = true) => fetch(`${origin}/api/uploads/presign`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signedIn ? { authorization: `Bearer ${ownerJwt}` } : {}) },
    body: JSON.stringify(body),
  });
  const batch = { collectionId: "test-collection", uploadId: "upload-1", names: ["IMG_1.jpg", "stage.png"] };

  expect((await sign(batch, false)).status).toBe(401);
  expect((await sign({ ...batch, names: ["../../other-gallery/x.jpg"] })).status).toBe(400);
  const response = await sign(batch);
  expect(response.status).toBe(200);
  const { urls } = await response.json() as { urls: string[] };
  expect(urls.map((url) => new URL(url).pathname)).toEqual([
    "/r2/fixture-bucket/uploads/test-collection/upload-1/IMG_1.jpg",
    "/r2/fixture-bucket/uploads/test-collection/upload-1/stage.png",
  ]);
  expect(urls.every((url) => new URL(url).searchParams.has("X-Amz-Signature"))).toBe(true);
});

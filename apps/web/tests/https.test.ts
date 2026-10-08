import { afterAll, beforeAll, expect, test } from "bun:test";
import { startApp } from "./app";

let app: Awaited<ReturnType<typeof startApp>>;

beforeAll(async () => {
  app = await startApp(3216, { canonicalOrigin: "https://findphotosofme.localhost" });
}, 90000);

afterAll(() => app?.stop());

const path = "/sign-in?redirect=%2Fadmin%3Fgallery%3Dtest";

test("HTTP redirects the root and event hosts to HTTPS, preserving the path and query", async () => {
  for (const host of ["findphotosofme.localhost", "itarena.findphotosofme.localhost"]) {
    const response = await fetch(app.origin + path, { headers: { host }, redirect: "manual" });
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`https://${host}${path}`);
  }
});

test("www moves to the main host, where people are signed in", async () => {
  for (const proto of ["http", "https"]) {
    const response = await fetch(app.origin + path, { headers: { host: "www.findphotosofme.localhost", "x-forwarded-proto": proto }, redirect: "manual" });
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`https://findphotosofme.localhost${path}`);
  }
});

test("HTTPS behind the edge proxy does not redirect again", async () => {
  const response = await fetch(`${app.origin}/sign-in`, {
    headers: { host: "findphotosofme.localhost", "x-forwarded-proto": "https" }, redirect: "manual",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
});

test("local development and unrelated hosts can still use HTTP", async () => {
  for (const host of ["localhost:3216", "findphotosofme.localhost.attacker.localhost", "otherfindphotosofme.localhost"]) {
    const response = await fetch(`${app.origin}/sign-in`, { headers: { host }, redirect: "manual" });
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  }
});

test("HTTP API requests redirect with a status that preserves the method and body", async () => {
  const response = await fetch(`${app.origin}/api/auth/sign-out`, {
    method: "POST", headers: { host: "findphotosofme.localhost" }, redirect: "manual",
  });
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("https://findphotosofme.localhost/api/auth/sign-out");
});

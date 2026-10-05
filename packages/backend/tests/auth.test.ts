import { betterAuth } from "better-auth/minimal";
import { createAuthEndpoint } from "better-auth/api";
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { createAuth } from "../convex/auth";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

test("private photo session checks can exceed the ordinary auth limit without relaxing other endpoints", async () => {
  vi.stubEnv("SITE_URL", "https://auth-test.example");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.example");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters");
  const rateLimit = await convexTest(schema, modules).run((ctx) => createAuth(ctx).options.rateLimit);
  const auth = betterAuth({
    baseURL: "https://auth-test.example",
    secret: "test-secret-at-least-32-characters",
    rateLimit: { ...rateLimit, storage: "memory" },
    plugins: [{
      id: "fixture",
      endpoints: {
        token: createAuthEndpoint("/convex/token", { method: "GET" }, async (ctx) => ctx.json({ token: "fixture" })),
        ordinary: createAuthEndpoint("/ordinary", { method: "GET" }, async (ctx) => ctx.json({ ok: true })),
      },
    }],
  });
  const limit = rateLimit?.max ?? 100;
  for (let index = 0; index <= limit; index++) {
    const response = await auth.handler(new Request("https://auth-test.example/api/auth/convex/token"));
    expect(response.status).toBe(200);
  }
  for (let index = 0; index <= limit; index++) {
    const response = await auth.handler(new Request("https://auth-test.example/api/auth/ordinary"));
    expect(response.status).toBe(index === limit ? 429 : 200);
  }
});

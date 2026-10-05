import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { getConvexAuthToken } from "../app/composables/useAuthClient";
import { ownerJwt } from "./backend";

let expired = false;
let disconnected = false;
const realFetch = globalThis.fetch;
const transport = spyOn(globalThis, "fetch").mockImplementation((...args: Parameters<typeof fetch>) =>
  disconnected ? Promise.reject(new TypeError("Network unavailable")) : realFetch(...args));
const backend = Bun.serve({
  port: 0,
  fetch: () => expired
    ? Response.json({ message: "Sign in required" }, { status: 401 })
    : Response.json({ token: ownerJwt }),
});
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

beforeAll(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: backend.url.origin } } });
});

afterAll(() => {
  backend.stop(true);
  transport.mockRestore();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("a valid session provides the Convex token", async () => {
  expect(await getConvexAuthToken()).toBe(ownerJwt);
});

test("an expired session provides no token", async () => {
  expired = true;
  try {
    expect(await getConvexAuthToken()).toBeNull();
  } finally {
    expired = false;
  }
});

test("a network interruption allows Convex to reconnect on the next request", async () => {
  disconnected = true;
  try {
    expect(await getConvexAuthToken()).toBeNull();
    disconnected = false;
    expect(await getConvexAuthToken()).toBe(ownerJwt);
  } finally {
    disconnected = false;
  }
});

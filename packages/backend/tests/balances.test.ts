import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DAY, INCLUDED_DAYS, PRICES, TRIAL_CREDIT } from "../convex/pricing";
import schema from "../convex/schema";

// Owner-only functions see the gallery owner signed in; the HTTP router gets no sign-in routes.
vi.mock("../convex/auth", async (original) => {
  const owner = { _id: "owner", email: "owner@example.com" };
  return { ...(await original<object>()), authComponent: { getAuthUser: async () => owner, safeGetAuthUser: async () => owner, registerRoutesLazy() {} } };
});

const modules = import.meta.glob("../convex/**/*.ts");
const serviceToken = "test-service-token";

beforeEach(() => {
  vi.stubEnv("SERVICE_TOKEN", serviceToken);
  // The HTTP router reads the site's origin when it first loads.
  vi.stubEnv("SITE_URL", "https://findphotosofme.test");
});

function setup() {
  const t = convexTest(schema, modules);
  const gallery = (fields: { createdBy?: string; trial?: boolean; expiresAt?: number; storagePaidUntil?: number; storedBytes?: number } = {}) =>
    t.run((ctx) => ctx.db.insert("collections", {
      subdomain: `gallery-${Math.random().toString(36).slice(2, 8)}`, title: "Harbor Summit", description: "",
      status: "complete", imagesCount: 120, storedBytes: 0, previewImages: [], createdBy: "owner", ...fields,
    }));
  const credit = (userId = "owner") => t.run(async (ctx) =>
    (await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", userId)).unique())?.credit ?? null);
  const setCredit = (credit: number, userId = "owner") => t.run(async (ctx) => {
    const balance = await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (balance) await ctx.db.patch(balance._id, { credit });
    else await ctx.db.insert("balances", { userId, credit, paid: false });
  });
  const read = (id: Id<"collections">) => t.run((ctx) => ctx.db.get(id));
  return { t, gallery, credit, setCredit, read };
}

describe("searches", () => {
  test("cost the gallery owner one search, and a search that couldn't run is given back once", async () => {
    const { t, gallery, credit, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(20);

    const requestId = await t.mutation(api.searchRequests.create, { collectionId });
    expect(await credit()).toBe(20 - PRICES.search);

    const failed = { id: requestId, serviceToken, status: "error" as const, error: "no_face" as const };
    await t.mutation(api.searchRequests.updateForService, failed);
    await t.mutation(api.searchRequests.updateForService, { ...failed, error: "failed" });
    expect(await credit()).toBe(20);
    expect((await t.query(api.searchRequests.getForService, { id: requestId, serviceToken }))?.error).toBe("no_face");
  });

  test("a late failure report keeps a finished search and its charge", async () => {
    const { t, gallery, credit, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(20);
    const requestId = await t.mutation(api.searchRequests.create, { collectionId });

    await t.mutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "complete", imagesFound: ["a.jpg"] });
    await t.mutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "error", error: "failed" });
    expect(await credit()).toBe(20 - PRICES.search);
    expect((await t.query(api.searchRequests.getForService, { id: requestId, serviceToken }))?.status).toBe("complete");
  });

  test("pause when the owner's balance can't cover them", async () => {
    const { t, gallery, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(PRICES.search - 1);
    await expect(t.mutation(api.searchRequests.create, { collectionId })).rejects.toThrow("Searching is paused");
  });

  test("are free in galleries from before accounts, which have no owner", async () => {
    const { t, gallery, credit } = setup();
    const collectionId = await gallery({ createdBy: undefined });
    await t.mutation(api.searchRequests.create, { collectionId });
    expect(await credit()).toBeNull();
  });
});

describe("top-ups", () => {
  const order = { providerOrderId: "order-1", userId: "owner", variantId: "v", subtotal: 2_000, total: 2_420, currency: "USD", testMode: true, purchasedAt: 0 };

  test("credit the price before tax once, and give trial galleries their full time", async () => {
    const { t, gallery, credit } = setup();
    const trialGallery = await gallery({ trial: true, expiresAt: 1 });

    await t.mutation(internal.payments.recordTopUp, order);
    await t.mutation(internal.payments.recordTopUp, order);
    expect(await credit()).toBe(TRIAL_CREDIT + 20_000);

    const extended = await t.run((ctx) => ctx.db.get(trialGallery));
    expect(extended?.trial).toBeUndefined();
    expect(extended?.expiresAt).toBe(extended!._creationTime + INCLUDED_DAYS * DAY);
  });

  test("refunds take back the refunded share as the running total grows", async () => {
    const { t, credit } = setup();
    await t.mutation(internal.payments.recordTopUp, order);
    await t.mutation(internal.payments.recordRefund, { providerOrderId: "order-1", refundedAmount: 1_210, full: false });
    expect(await credit()).toBe(TRIAL_CREDIT + 10_000);
    await t.mutation(internal.payments.recordRefund, { providerOrderId: "order-1", refundedAmount: 2_420, full: true });
    await t.mutation(internal.payments.recordRefund, { providerOrderId: "order-1", refundedAmount: 2_420, full: true });
    expect(await credit()).toBe(TRIAL_CREDIT);
  });

  test("come from signed orders in the deployment's own mode", async () => {
    const { t, credit } = setup();
    vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "webhook-secret");
    vi.stubEnv("LEMONSQUEEZY_STORE_ID", "1");
    vi.stubEnv("LEMONSQUEEZY_PRODUCT_ID", "2");
    vi.stubEnv("LEMONSQUEEZY_TEST_MODE", "false");
    const deliver = async (id: string, testMode: boolean) => {
      const body = JSON.stringify({
        meta: { event_name: "order_created", custom_data: { user_id: "owner" } },
        data: { type: "orders", id, attributes: {
          store_id: 1, status: "paid", test_mode: testMode, first_order_item: { product_id: 2, variant_id: 3 },
          subtotal_usd: 1_000, discount_total_usd: 0, total: 1_210, currency: "USD", created_at: "2026-10-08T00:00:00Z",
        } },
      });
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("webhook-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))).toString("hex");
      return t.fetch("/api/lemonsqueezy/webhook", { method: "POST", body, headers: { "x-signature": signature } });
    };

    expect((await deliver("test-order", true)).status).toBe(400);
    expect((await deliver("live-order", false)).status).toBe(200);
    expect(await credit()).toBe(TRIAL_CREDIT + 10_000);
  });
});

describe("storage", () => {
  // 30 GB costs $0.05 a day
  const size = { storedBytes: 30e9 };
  const DAILY = 50;

  test("is free during the paid time, then taken a day at a time", async () => {
    const { t, gallery, credit, setCredit, read } = setup();
    const due = Date.now() - 60_000;
    const included = await gallery({ ...size, storagePaidUntil: Date.now() + DAY, expiresAt: Date.now() + 10 * DAY });
    const past = await gallery({ ...size, storagePaidUntil: due, expiresAt: Date.now() + 10 * DAY });
    await setCredit(1_000);

    await t.mutation(internal.balances.chargeStorage, {});
    await t.mutation(internal.balances.chargeStorage, {});
    expect(await credit()).toBe(1_000 - DAILY);
    expect((await read(past))?.storagePaidUntil).toBe(due + DAY);
    expect((await read(included))?.storagePaidUntil).toBeGreaterThan(Date.now());
  });

  test("takes a gallery offline when the balance can't cover the next day", async () => {
    const { t, gallery, credit, setCredit, read } = setup();
    const id = await gallery({ ...size, storagePaidUntil: Date.now() - 60_000, expiresAt: Date.now() + 10 * DAY });
    await setCredit(DAILY - 1);

    await t.mutation(internal.balances.chargeStorage, {});
    expect(await credit()).toBe(DAILY - 1);
    expect((await read(id))?.expiresAt).toBeLessThanOrEqual(Date.now());
  });

  test("brings an offline gallery back once the balance covers a day, without charging the days it was offline", async () => {
    const { t, gallery, credit, setCredit } = setup();
    const offlineSince = Date.now() - 5 * DAY;
    const id = await gallery({ ...size, storagePaidUntil: offlineSince, expiresAt: offlineSince });
    const until = Date.now() + 20 * DAY;
    await setCredit(0);
    await expect(t.mutation(api.balances.keepOnlineUntil, { id, until })).rejects.toThrow("costs $0.05 a day");

    await setCredit(1_000);
    await t.mutation(api.balances.keepOnlineUntil, { id, until });
    await t.mutation(internal.balances.chargeStorage, {});
    expect(await credit()).toBe(1_000 - DAILY);
  });
});

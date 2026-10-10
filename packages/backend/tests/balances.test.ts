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
  const secret = "webhook-secret";
  beforeEach(() => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", secret);
    vi.stubEnv("CREEM_PRODUCT_ID", "prod_credit");
  });

  // Shaped like the events Creem's test mode delivers, in cents: the chosen amount, less any promo code, plus tax.
  const paid = (orderId: string, { product = "prod_credit", subtotal = 2_000, discount = 0, tax = 420 } = {}) => ({
    eventType: "checkout.completed",
    object: {
      object: "checkout", metadata: { userId: "owner" },
      order: {
        id: orderId, product, amount: subtotal, sub_total: subtotal, discount_amount: discount, tax_amount: tax,
        amount_paid: subtotal - discount + tax, currency: "USD", status: "paid", created_at: "2026-10-09T14:58:07.056Z", mode: "test",
      },
    },
  });
  const refunded = (orderId: string, refundId: string, amount: number) => ({
    eventType: "refund.created",
    object: { id: refundId, object: "refund", status: "succeeded", refund_amount: amount, order: { id: orderId, product: "prod_credit" } },
  });

  async function deliver(t: ReturnType<typeof setup>["t"], event: object, key = secret) {
    const body = JSON.stringify(event);
    const hmac = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = Buffer.from(await crypto.subtle.sign("HMAC", hmac, new TextEncoder().encode(body))).toString("hex");
    return t.fetch("/api/creem/webhook", { method: "POST", body, headers: { "creem-signature": signature } });
  }

  test("credit the price before tax once, and give trial galleries their full time", async () => {
    const { t, gallery, credit } = setup();
    const trialGallery = await gallery({ trial: true, expiresAt: 1 });

    expect((await deliver(t, paid("ord_1"))).status).toBe(200);
    expect((await deliver(t, paid("ord_1"))).status).toBe(200);
    expect(await credit()).toBe(TRIAL_CREDIT + 20_000);

    const extended = await t.run((ctx) => ctx.db.get(trialGallery));
    expect(extended?.trial).toBeUndefined();
    expect(extended?.expiresAt).toBe(extended!._creationTime + INCLUDED_DAYS * DAY);
  });

  test("refunds take back their share of the credit, each one once", async () => {
    const { t, credit } = setup();
    await deliver(t, paid("ord_1"));

    await deliver(t, refunded("ord_1", "ref_1", 1_210));
    await deliver(t, refunded("ord_1", "ref_1", 1_210));
    expect(await credit()).toBe(TRIAL_CREDIT + 10_000);

    await deliver(t, refunded("ord_1", "ref_2", 1_210));
    expect(await credit()).toBe(TRIAL_CREDIT);
    const order = await t.run((ctx) => ctx.db.query("paymentOrders").first());
    expect(order).toMatchObject({ status: "refunded", refundedAmount: 2_420 });
  });

  test("promo codes still credit the full chosen amount, even when they make it free", async () => {
    const { t, credit } = setup();
    await deliver(t, paid("ord_free", { discount: 2_000, tax: 0 }));
    expect(await credit()).toBe(TRIAL_CREDIT + 20_000);

    await deliver(t, paid("ord_half", { discount: 1_000, tax: 210 }));
    expect(await credit()).toBe(TRIAL_CREDIT + 40_000);
    await deliver(t, refunded("ord_half", "ref_half", 1_210));
    expect(await credit()).toBe(TRIAL_CREDIT + 20_000);
  });

  test("come only from signed payments for the credit product", async () => {
    const { t, credit } = setup();
    expect((await deliver(t, paid("ord_forged"), "another-secret")).status).toBe(401);
    expect((await deliver(t, paid("ord_other", { product: "prod_other" }))).status).toBe(400);
    expect(await credit()).toBeNull();
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

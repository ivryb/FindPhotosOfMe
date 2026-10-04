import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { DAY, INCLUDED_DAYS, PRICES, TRIAL_CREDIT } from "../convex/pricing";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const serviceToken = "test-service-token";

beforeEach(() => {
  vi.stubEnv("SERVICE_TOKEN", serviceToken);
});

function setup() {
  const t = convexTest(schema, modules);
  const gallery = (fields: { createdBy?: string; trial?: boolean; expiresAt?: number } = {}) =>
    t.run((ctx) => ctx.db.insert("collections", {
      subdomain: `gallery-${Math.random().toString(36).slice(2, 8)}`, title: "Harbor Summit", description: "",
      status: "complete", imagesCount: 120, storedBytes: 0, previewImages: [], createdBy: "owner", ...fields,
    }));
  const credit = (userId = "owner") => t.run(async (ctx) =>
    (await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", userId)).unique())?.credit ?? null);
  const setCredit = (credit: number, userId = "owner") => t.run(async (ctx) => {
    await ctx.db.insert("balances", { userId, credit, paid: false });
  });
  return { t, gallery, credit, setCredit };
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

describe("uploads", () => {
  async function runningJob(t: ReturnType<typeof setup>["t"], collectionId: Id<"collections">) {
    const jobId = await t.run((ctx) => ctx.db.insert("ingestJobs", {
      collectionId, fileKey: "uploads/day-1.zip", filename: "day-1.zip", status: "pending", processedImages: 0, createdAt: 0,
    }));
    await t.mutation(internal.ingestJobs.claimNextForCollection, { collectionId });
    return jobId;
  }

  test("reserve every photo, then return the photos without faces", async () => {
    const { t, gallery, credit, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(100);
    const jobId = await runningJob(t, collectionId);

    await t.mutation(api.balances.reserveIngestForService, { jobId, images: 10, serviceToken });
    // A replayed job reserves nothing more.
    await t.mutation(api.balances.reserveIngestForService, { jobId, images: 10, serviceToken });
    expect(await credit()).toBe(100 - 10 * PRICES.photo);

    await t.mutation(api.ingestJobs.markCompleted, { id: jobId, processedImages: 10, savedImages: 7, savedBytes: 7e6, serviceToken });
    expect(await credit()).toBe(100 - 7 * PRICES.photo);
    const stored = await t.run((ctx) => ctx.db.get(collectionId));
    expect(stored?.storedBytes).toBe(7e6);
  });

  test("give the whole reservation back when processing fails, and charge a retry again", async () => {
    const { t, gallery, credit, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(100);
    const jobId = await runningJob(t, collectionId);
    await t.mutation(api.balances.reserveIngestForService, { jobId, images: 10, serviceToken });
    await t.mutation(api.ingestJobs.markFailed, { id: jobId, error: "Damaged ZIP", serviceToken });
    expect(await credit()).toBe(100);

    await t.run((ctx) => ctx.db.patch(jobId, { status: "pending" }));
    await t.mutation(internal.ingestJobs.claimNextForCollection, { collectionId });
    await t.mutation(api.balances.reserveIngestForService, { jobId, images: 10, serviceToken });
    expect(await credit()).toBe(100 - 10 * PRICES.photo);
  });

  test("don't start when the balance can't cover the ZIP", async () => {
    const { t, gallery, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(4 * PRICES.photo);
    const jobId = await runningJob(t, collectionId);
    await expect(t.mutation(api.balances.reserveIngestForService, { jobId, images: 5, serviceToken }))
      .rejects.toThrow("This ZIP has 5 photos ($0.02), but your balance is $0.02");
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
});

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { QueryCtx } from "../convex/_generated/server";
import { MAX_PHOTO_BYTES } from "../convex/photoKeys";
import { DAY, PRICES, dailyStorageCost } from "../convex/pricing";
import schema from "../convex/schema";

vi.mock("../convex/auth", async (original) => {
  const user = async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? { _id: identity.subject, email: `${identity.subject}@example.com` } : null;
  };
  return { ...(await original<object>()), authComponent: { getAuthUser: user, safeGetAuthUser: user } };
});

const modules = import.meta.glob("../convex/**/*.ts");
const serviceToken = "staging-test";
const photos = [{ name: "a.jpg", size: 123 }];
beforeEach(() => { vi.stubEnv("SERVICE_TOKEN", serviceToken); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function setup(credit = PRICES.photo) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner" });
  const collectionId = await owner.mutation(api.collections.create, { title: "Weekend", description: "" });
  await owner.mutation(api.collections.update, { id: collectionId, title: "Weekend", description: "", crowdsource: true });
  await owner.mutation(api.collections.setPublished, { id: collectionId, published: true });
  const gallery = await owner.query(api.collections.get, { id: collectionId });
  const access = { shareToken: gallery.shareToken!, contributorKey: "a".repeat(32) };
  await t.run(async (ctx) => {
    const balance = await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", "owner")).unique();
    await ctx.db.patch(balance!._id, { credit });
  });
  const start = (name = "photos", guest = access) => t.mutation(api.uploads.start, { collectionId, name, size: 123, photos: 1, access: guest });
  const balance = () => t.run((ctx) => ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", "owner")).unique());
  const charges = () => t.run(async (ctx) => (await ctx.db.query("balanceEntries").collect()).filter((entry) => entry.reason === "photos" || entry.reason === "photos_returned"));
  return { t, owner, collectionId, access, start, balance, charges };
}

test("reserves once for exact files and sizes, without extending the URL window or charging", async () => {
  const { t, owner, access, start, balance, charges } = await setup();
  const { uploadId } = await start();
  const args = { uploadId, first: 0, photos, access };
  const batch = await t.mutation(api.uploads.prepareBatch, args);
  vi.setSystemTime(Date.now() + 60_000);
  expect(await t.mutation(api.uploads.prepareBatch, args)).toEqual(batch);
  expect(await balance()).toMatchObject({ credit: PRICES.photo, reserved: PRICES.photo });
  expect(await owner.query(api.balances.mine, {})).toMatchObject({ credit: 0 });
  expect(await charges()).toEqual([]);
  await expect(t.mutation(api.uploads.prepareBatch, { ...args, photos: [{ name: "other.jpg", size: 123 }] })).rejects.toThrow("different photos");
  await expect(t.mutation(api.uploads.prepareBatch, { ...args, photos: [{ name: "a.jpg", size: 124 }] })).rejects.toThrow("different photos");
});

test("other uploads and searches cannot spend money held by an unfinished guest upload", async () => {
  const { t, owner, collectionId, access, start, balance } = await setup();
  const first = await start();
  const otherAccess = { ...access, contributorKey: "b".repeat(32) };
  const second = await start("other photos", otherAccess);
  await t.mutation(api.uploads.prepareBatch, { uploadId: first.uploadId, first: 0, photos, access });
  await expect(t.mutation(api.uploads.prepareBatch, { uploadId: second.uploadId, first: 0, photos, access: otherAccess })).rejects.toThrow("owner’s balance");
  await expect(start("third upload")).rejects.toThrow("owner’s balance");
  await t.run((ctx) => ctx.db.patch(collectionId, { imagesCount: 1 }));
  await expect(owner.mutation(api.searchRequests.create, { collectionId })).rejects.toThrow("Searching is paused");
  expect(await balance()).toMatchObject({ credit: PRICES.photo, reserved: PRICES.photo });
  expect(await t.run((ctx) => ctx.db.query("uploadBatches").collect())).toHaveLength(1);
});

test("storage billing leaves upload holds intact when the available balance runs out", async () => {
  // The balance covers a day of the older gallery's storage, but not once the upload's hold is set aside
  const day = dailyStorageCost({ storedBytes: 30e9, imagesCount: 0 });
  const { t, owner, access, start, balance } = await setup(day);
  const otherId = await owner.mutation(api.collections.create, { title: "Older gallery", description: "" });
  await t.run((ctx) => ctx.db.patch(otherId, { trial: undefined, storedBytes: 30e9, storagePaidUntil: Date.now() - 60_000, expiresAt: Date.now() + DAY }));
  const { uploadId } = await start();
  await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos, access });
  await t.mutation(internal.balances.chargeStorage, {});
  expect(await balance()).toMatchObject({ credit: day, reserved: PRICES.photo });
  expect((await t.run((ctx) => ctx.db.get(otherId)))?.expiresAt).toBeLessThanOrEqual(Date.now());
});

test("empty photos can reach processing and reservations span the owner's galleries", async () => {
  const { t, owner, access, start, balance } = await setup();
  const otherId = await owner.mutation(api.collections.create, { title: "Other gallery", description: "" });
  const other = await owner.mutation(api.uploads.start, { collectionId: otherId, name: "other", size: 1, photos: 1 });
  const { uploadId } = await start();
  await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "empty.jpg", size: 0 }], access });
  await expect(owner.mutation(api.uploads.prepareBatch, { uploadId: other.uploadId, first: 0, photos })).rejects.toThrow("balance ran out");
  expect(await balance()).toMatchObject({ credit: PRICES.photo, reserved: PRICES.photo });
});

test.each([-1, 0.5, MAX_PHOTO_BYTES + 1])("refuses a photo size of %s before granting storage", async (size) => {
  const { t, access, start, balance } = await setup();
  const { uploadId } = await start();
  await expect(t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "a.jpg", size }], access })).rejects.toThrow("Invalid batch");
  expect((await balance())?.reserved ?? 0).toBe(0);
});

test("only server confirmation turns a hold into one charge and queues the batch", async () => {
  const { t, collectionId, access, start, balance, charges } = await setup();
  const { uploadId } = await start();
  const { batchId } = await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos, access });
  await expect(t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken: "wrong" })).rejects.toThrow();
  expect(await balance()).toMatchObject({ credit: PRICES.photo, reserved: PRICES.photo });
  expect((await t.run((ctx) => ctx.db.get(uploadId)))?.sent).toBe(0);
  await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  expect(await balance()).toMatchObject({ credit: 0, reserved: 0 });
  expect(await charges()).toHaveLength(1);
  expect((await t.run((ctx) => ctx.db.get(uploadId)))?.sent).toBe(1);
  expect(await t.query(api.uploads.getStagingBatch, { id: batchId, access })).toMatchObject({ status: "pending", names: ["a.jpg"], sizes: [123] });
  expect(await t.query(api.uploads.getBatchForService, { id: batchId, serviceToken })).toMatchObject({
    photos: [{ name: "a.jpg", source: `uploads/${collectionId}/${batchId}/a.jpg` }],
  });
});

test("expired holds remain until storage cleanup, then release once without a charge or refund", async () => {
  const { t, collectionId, access, start, balance, charges } = await setup();
  const { uploadId } = await start();
  const args = { uploadId, first: 0, photos, access };
  const { batchId, expiresAt } = await t.mutation(api.uploads.prepareBatch, args);
  vi.setSystemTime(expiresAt);
  await expect(t.mutation(api.uploads.prepareBatch, args)).rejects.toThrow("expired");
  await expect(t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken })).rejects.toThrow("expired");
  expect(await t.query(internal.uploads.expiredStagingBatch, { id: batchId })).toBeNull();
  await t.mutation(internal.uploads.releaseExpiredBatch, { id: batchId });
  expect((await balance())?.reserved).toBe(PRICES.photo);
  vi.setSystemTime(expiresAt + 60_000);
  expect(await t.query(internal.uploads.expiredStagingBatch, { id: batchId })).toEqual({ collectionId, names: ["a.jpg"] });
  await t.mutation(internal.uploads.releaseExpiredBatch, { id: batchId });
  await t.mutation(internal.uploads.releaseExpiredBatch, { id: batchId });
  expect(await balance()).toMatchObject({ credit: PRICES.photo, reserved: 0 });
  expect(await charges()).toEqual([]);
  const retry = await t.mutation(api.uploads.prepareBatch, args);
  expect(retry.batchId).not.toBe(batchId);
  expect(await t.query(internal.uploads.expiredStagingBatch, { id: batchId })).toBeNull();
});

test("deleting a gallery releases its uncharged holds", async () => {
  const { t, owner, collectionId, access, start, balance, charges } = await setup();
  const { uploadId } = await start();
  await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos, access });
  await owner.mutation(api.collections.deleteCollection, { id: collectionId });
  expect(await balance()).toMatchObject({ credit: PRICES.photo, reserved: 0 });
  expect(await charges()).toEqual([]);
});

test("owner deletion settles pending refunds without releasing another upload's hold", async () => {
  const { t, owner, collectionId, access, start, balance, charges } = await setup(3 * PRICES.photo);
  const { uploadId } = await start();
  const { batchId } = await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos, access });
  await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  await t.mutation(api.uploads.completeBatchForService, { id: batchId, saved: [], savedBytes: 0, serviceToken });
  const otherId = await owner.mutation(api.collections.create, { title: "Other gallery", description: "" });
  const other = await owner.mutation(api.uploads.start, { collectionId: otherId, name: "other", size: 123, photos: 1 });
  await owner.mutation(api.uploads.prepareBatch, { uploadId: other.uploadId, first: 0, photos });
  expect(await balance()).toMatchObject({ credit: 2 * PRICES.photo, reserved: PRICES.photo });
  await owner.mutation(api.collections.deleteCollection, { id: collectionId });
  expect(await balance()).toMatchObject({ credit: 3 * PRICES.photo, reserved: PRICES.photo });
  expect((await charges()).map((entry) => entry.reason)).toEqual(["photos", "photos_returned"]);
});

test.each(["commit", "expire", "delete"])("claiming a legacy gallery before %s does not release a hold that was never made", async (finish) => {
  const { t, owner, balance } = await setup(3 * PRICES.photo);
  vi.stubEnv("LEGACY_OWNER_EMAIL", "owner@example.com");
  const collectionId = await t.run((ctx) => ctx.db.insert("collections", {
    title: "Legacy gallery", description: "", subdomain: "legacy", status: "not_started", imagesCount: 0,
  }));
  const { uploadId } = await owner.mutation(api.uploads.start, { collectionId, name: "photos", size: 123, photos: 1 });
  const { batchId, expiresAt } = await owner.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos });
  await owner.mutation(api.collections.update, { id: collectionId, title: "Legacy gallery", description: "", subdomain: "legacy" });
  if (finish === "commit") {
    await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  } else if (finish === "expire") {
    vi.setSystemTime(expiresAt + 60_000);
    await t.mutation(internal.uploads.releaseExpiredBatch, { id: batchId });
  } else {
    await owner.mutation(api.collections.deleteCollection, { id: collectionId });
  }
  const final = await balance();
  expect(final?.credit).toBe((finish === "commit" ? 2 : 3) * PRICES.photo);
  expect(final?.reserved ?? 0).toBe(0);
});

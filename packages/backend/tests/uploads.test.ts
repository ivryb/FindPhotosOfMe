import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { photoKey, stagingKey } from "../convex/photoKeys";
import { PRICES } from "../convex/pricing";
import schema from "../convex/schema";
import { MAX_RUNNING_BATCHES, STALLED_AFTER } from "../convex/uploads";

// Owner-only functions see the gallery owner signed in.
vi.mock("../convex/auth", async (original) => {
  const owner = { _id: "owner", email: "owner@example.com" };
  return { ...(await original<object>()), authComponent: { getAuthUser: async () => owner, safeGetAuthUser: async () => owner } };
});

const modules = import.meta.glob("../convex/**/*.ts");
const serviceToken = "test-service-token";
const names = (count: number, from = 0) => Array.from({ length: count }, (_, n) => `photo-${from + n}.jpg`);

beforeEach(() => {
  vi.stubEnv("SERVICE_TOKEN", serviceToken);
  // Scheduled dispatches run only when a test asks; workers are called over HTTP.
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function setup() {
  const t = convexTest(schema, modules);
  const gallery = (createdBy = "owner") => t.run((ctx) => ctx.db.insert("collections", {
    subdomain: `gallery-${Math.random().toString(36).slice(2, 8)}`, title: "Harbor Summit", description: "",
    status: "not_started", imagesCount: 0, storedBytes: 0, previewImages: [], createdBy,
  }));
  const setCredit = (credit: number) => t.run(async (ctx) => {
    await ctx.db.insert("balances", { userId: "owner", credit, paid: false });
  });
  const credit = () => t.run(async (ctx) =>
    (await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", "owner")).unique())?.credit);
  const batches = (collectionId: Id<"collections">) => t.run((ctx) =>
    ctx.db.query("uploadBatches").collect().then((all) => all.filter((batch) => batch.collectionId === collectionId)));
  return { t, gallery, setCredit, credit, batches };
}

/** Starts an upload and registers its photos in batches of 50, as the browser does. */
async function sendPhotos(t: ReturnType<typeof setup>["t"], collectionId: Id<"collections">, photos: number) {
  const { uploadId } = await t.mutation(api.uploads.start, { collectionId, name: "day-1.zip", size: 1e9, photos });
  for (let first = 0; first < photos; first += 50) {
    await t.mutation(api.uploads.addBatch, { uploadId, first, names: names(Math.min(50, photos - first), first) });
  }
  return uploadId;
}

describe("sending photos", () => {
  test("is refused up front when the balance can't cover the upload", async () => {
    const { t, gallery, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(4 * PRICES.photo);
    await expect(t.mutation(api.uploads.start, { collectionId, name: "day-1.zip", size: 1, photos: 5 }))
      .rejects.toThrow("day-1.zip has 5 photos ($0.02), but your balance is $0.02");
  });

  test("charges each batch once as it arrives, and resumes an interrupted upload where it stopped", async () => {
    const { t, gallery, setCredit, credit } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    const { uploadId } = await t.mutation(api.uploads.start, { collectionId, name: "day-1.zip", size: 1e9, photos: 120 });

    await t.mutation(api.uploads.addBatch, { uploadId, first: 0, names: names(50) });
    // A lost response makes the browser send the same batch again.
    await t.mutation(api.uploads.addBatch, { uploadId, first: 0, names: names(50) });
    expect(await credit()).toBe(1_000 - 50 * PRICES.photo);
    await expect(t.mutation(api.uploads.addBatch, { uploadId, first: 100, names: names(20, 100) })).rejects.toThrow();

    // Adding the same ZIP again continues it.
    expect(await t.mutation(api.uploads.start, { collectionId, name: "day-1.zip", size: 1e9, photos: 120 })).toEqual({ uploadId, sent: 50 });
    const gallerySoFar = await t.run((ctx) => ctx.db.get(collectionId));
    expect(gallerySoFar?.status).toBe("processing");
  });

  test("refuses photo names that aren't plain JPEG or PNG file names", async () => {
    const { t, gallery, setCredit } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    const { uploadId } = await t.mutation(api.uploads.start, { collectionId, name: "day-1.zip", size: 1, photos: 1 });
    await expect(t.mutation(api.uploads.addBatch, { uploadId, first: 0, names: ["../other-gallery/x.jpg"] })).rejects.toThrow();
  });
});

describe("processing", () => {
  test("a finished batch keeps photos with faces, returns the rest, and fills in the gallery", async () => {
    const { t, gallery, setCredit, credit, batches } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    const uploadId = await sendPhotos(t, collectionId, 50);
    const [batch] = await batches(collectionId);

    const work = await t.query(api.uploads.getBatchForService, { id: batch!._id, serviceToken });
    expect(work?.photos[0]).toEqual({ name: "photo-0.jpg", source: stagingKey(collectionId, uploadId, "photo-0.jpg"), key: photoKey(collectionId, uploadId, "photo-0.jpg") });

    const done = { id: batch!._id, saved: names(30), savedBytes: 3e6, serviceToken };
    await t.mutation(api.uploads.completeBatchForService, done);
    await t.mutation(api.uploads.completeBatchForService, done);
    expect(await credit()).toBe(1_000 - 30 * PRICES.photo);

    const filled = await t.run((ctx) => ctx.db.get(collectionId));
    expect(filled).toMatchObject({ imagesCount: 30, storedBytes: 3e6, status: "complete" });
    expect(filled?.previewImages?.[0]).toBe(photoKey(collectionId, uploadId, "photo-0.jpg"));
    const [upload] = await t.query(api.uploads.list, { collectionId });
    expect(upload).toMatchObject({ photos: 50, sent: 50, processed: 50, saved: 30, failed: 0 });
  });

  test("workers are capped and shared between galleries, so one big upload doesn't hold up the others", async () => {
    const { t, gallery, setCredit } = setup();
    const big = await gallery();
    const small = await gallery();
    await setCredit(100_000);
    await sendPhotos(t, big, 50 * (MAX_RUNNING_BATCHES + 2));
    await sendPhotos(t, small, 50);

    const claimed = await t.mutation(internal.uploads.claim, {});
    expect(claimed).toHaveLength(MAX_RUNNING_BATCHES);
    const owners = await t.run((ctx) => Promise.all(claimed.map((id) => ctx.db.get(id))));
    expect(owners.some((batch) => batch?.collectionId === small)).toBe(true);
    expect(await t.mutation(internal.uploads.claim, {})).toEqual([]);
  });

  test("a batch the worker service didn't accept waits for it without using up a try", async () => {
    const { t, gallery, setCredit, batches } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    await sendPhotos(t, collectionId, 50);

    for (let outage = 0; outage < 5; outage++) {
      const [id] = await t.mutation(internal.uploads.claim, {});
      await t.mutation(internal.uploads.release, { id: id! });
    }
    const [batch] = await batches(collectionId);
    expect(batch).toMatchObject({ status: "pending", attempts: 0 });
  });

  test("a gallery that just started uploading gets a worker even behind thousands of another gallery's photos", async () => {
    const { t, gallery, setCredit } = setup();
    const busy = await gallery();
    const quiet = await gallery();
    await setCredit(1_000);
    const { uploadId } = await t.mutation(api.uploads.start, { collectionId: busy, name: "huge.zip", size: 1, photos: 1 });
    await t.run(async (ctx) => {
      await ctx.db.patch(busy, { status: "processing" });
      for (let n = 0; n < 600; n++) await ctx.db.insert("uploadBatches", { collectionId: busy, uploadId, names: ["a.jpg"], status: "pending", attempts: 0 });
    });
    await sendPhotos(t, quiet, 50);

    const claimed = await t.mutation(internal.uploads.claim, {});
    const galleries = await t.run((ctx) => Promise.all(claimed.map((id) => ctx.db.get(id))));
    expect(galleries.some((batch) => batch?.collectionId === quiet)).toBe(true);
  });

  test("deleting a gallery refunds the photos still waiting to be processed", async () => {
    const { t, gallery, setCredit, credit, batches } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    await sendPhotos(t, collectionId, 100);
    const [first] = await batches(collectionId);
    await t.mutation(api.uploads.completeBatchForService, { id: first!._id, saved: names(50), savedBytes: 1, serviceToken });

    await t.mutation(api.collections.deleteCollection, { id: collectionId });
    expect(await credit()).toBe(1_000 - 50 * PRICES.photo);
  });

  test("a batch whose worker went quiet is retried, then given up and refunded after three tries", async () => {
    const { t, gallery, setCredit, credit, batches } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    await sendPhotos(t, collectionId, 50);

    for (let attempt = 1; attempt <= 3; attempt++) {
      expect(await t.mutation(internal.uploads.claim, {})).toHaveLength(1);
      vi.setSystemTime(Date.now() + STALLED_AFTER + 1);
      await t.mutation(internal.uploads.recover, {});
    }
    const [batch] = await batches(collectionId);
    expect(batch?.status).toBe("failed");
    expect(await credit()).toBe(1_000);
    const [upload] = await t.query(api.uploads.list, { collectionId });
    expect(upload).toMatchObject({ processed: 50, failed: 50 });
    expect((await t.run((ctx) => ctx.db.get(collectionId)))?.status).toBe("complete");
  });
});

describe("merging faces", () => {
  test("starts once a gallery has no batches left to process, one merge at a time", async () => {
    const { t, gallery, setCredit, batches } = setup();
    const collectionId = await gallery();
    await setCredit(1_000);
    await sendPhotos(t, collectionId, 100);
    const [first, second] = await batches(collectionId);

    await t.mutation(api.uploads.completeBatchForService, { id: first!._id, saved: names(5), savedBytes: 1, serviceToken });
    // The other batch is still processing, and one finished batch isn't worth a merge yet.
    expect(await t.mutation(internal.uploads.claimMerge, { collectionId })).toBeNull();

    await t.mutation(api.uploads.completeBatchForService, { id: second!._id, saved: names(5, 50), savedBytes: 1, serviceToken });
    const merging = await t.mutation(internal.uploads.claimMerge, { collectionId });
    expect(merging?.sort()).toEqual([first!._id, second!._id].sort());
    expect(await t.mutation(internal.uploads.claimMerge, { collectionId })).toBeNull();

    await t.mutation(api.uploads.facesMergedForService, { collectionId, batchIds: merging!, serviceToken });
    expect((await batches(collectionId)).map((batch) => batch.status)).toEqual(["merged", "merged"]);
    expect((await t.run((ctx) => ctx.db.get(collectionId)))?.mergingSince).toBeUndefined();
  });
});

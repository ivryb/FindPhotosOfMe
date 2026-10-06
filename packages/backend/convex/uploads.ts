import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { canAccessGallery, requireActiveCollection, requireCollectionOwner, requireServiceToken } from "./authz";
import { charge, releasePhotos, requireCredit, reservePhotos, returnPhotos, returnPhotosNow } from "./balances";
import { BATCH_PHOTOS, MAX_PHOTO_BYTES, PHOTO_NAME, STAGING_URL_LIFETIME_MS, photoKey, stagingKey } from "./photoKeys";
import { PRICES, formatMoney } from "./pricing";
import { batchStatus, uploadFields } from "./schema";

// The upload queue. Each batch reserves credit before storage URLs are issued and is charged only after the server
// verifies its files arrived. Crowdsourced galleries keep all valid photos; others keep faces.
// Workers write each batch’s faces to its own file; merges fold those files into the gallery’s face index.
// recover runs every few minutes (crons.ts) and retries whatever a lost worker or request left behind.

/** Batches processed at once across all galleries. Matches max_containers of process_batch in python/modal_app.py. */
export const MAX_RUNNING_BATCHES = 10;
/**
 * A running batch or merge with no result by now lost its worker. The workers' time limits in python/modal_app.py
 * are shorter, so a retried batch never runs beside the worker it replaces.
 */
export const STALLED_AFTER = 10 * 60 * 1000;
/** Tries a batch gets before its photos are given up and refunded. */
const MAX_ATTEMPTS = 3;
/** Finished batches worth merging while more of the gallery is still processing. */
const MERGE_EVERY = 20;
// URLs must be unusable before cleanup gives their credit back, including small clock differences.
export const STAGING_CLEANUP_GRACE = 60 * 1000;
export const stagingPhoto = v.object({ name: v.string(), size: v.number() });

// Each guest browser or Telegram chat owns its uploads, independently of other link holders.
export const guestAccess = v.object({ shareToken: v.optional(v.string()), contributorKey: v.string() });
type GuestAccess = typeof guestAccess.type;

async function requireUploadCollection(ctx: QueryCtx, collectionId: Id<"collections">, access?: GuestAccess) {
  if (!access) {
    const { collection } = await requireCollectionOwner(ctx, collectionId);
    requireActiveCollection(collection);
    return collection;
  }
  const collection = await ctx.db.get(collectionId);
  if (!collection || !canAccessGallery(collection, access.shareToken)) throw new ConvexError("This gallery is private or offline.");
  if (!collection.crowdsource) throw new ConvexError("Guest uploads are turned off.");
  if (!/^[a-f0-9]{32}$/.test(access.contributorKey)) throw new Error("Invalid contributor key");
  return collection;
}

async function requireUpload(ctx: QueryCtx, uploadId: Id<"uploads">, access?: GuestAccess) {
  const upload = await ctx.db.get(uploadId);
  if (!upload) throw new Error("Upload not found");
  const collection = await requireUploadCollection(ctx, upload.collectionId, access);
  if (access && upload.contributorKey !== access.contributorKey) throw new Error("Not authorized");
  return { upload, collection };
}

/** Starts an upload, or continues an interrupted one with the same name and size. */
export const start = mutation({
  args: { collectionId: v.id("collections"), name: v.string(), size: v.number(), photos: v.number(), access: v.optional(guestAccess) },
  returns: v.object({ uploadId: v.id("uploads"), sent: v.number() }),
  handler: async (ctx, { collectionId, name, size, photos, access }) => {
    const collection = await requireUploadCollection(ctx, collectionId, access);
    if (!Number.isInteger(photos) || photos < 1) throw new ConvexError(`${name} has no JPEG or PNG photos.`);
    const uploads = await ctx.db.query("uploads").withIndex("by_contributor", (q) => q.eq("collectionId", collectionId).eq("contributorKey", access?.contributorKey)).collect();
    const interrupted = uploads.find((upload) => upload.name === name && upload.size === size && upload.photos === photos && upload.sent < photos);
    if (interrupted) return { uploadId: interrupted._id, sent: interrupted.sent };

    if (collection.createdBy) {
      const cost = photos * PRICES.photo;
      await requireCredit(ctx, collection.createdBy, cost, (credit) =>
        access ? "Uploads are paused because the gallery owner’s balance cannot cover these photos. Ask the owner to top up." : `${name} has ${photos.toLocaleString("en-US")} photos (${formatMoney(cost)}), but your balance is ${formatMoney(credit)}. Top up, then add it again.`);
    }
    const uploadId = await ctx.db.insert("uploads", { collectionId, name, size, photos, contributorKey: access?.contributorKey, sent: 0, processed: 0, saved: 0, failed: 0 });
    return { uploadId, sent: 0 };
  },
});

/** Holds credit for exact storage paths and sizes. Repeating a request reuses its hold and original URL deadline. */
export const prepareBatch = mutation({
  args: { uploadId: v.id("uploads"), first: v.number(), photos: v.array(stagingPhoto), access: v.optional(guestAccess) },
  returns: v.object({ batchId: v.id("uploadBatches"), collectionId: v.id("collections"), expiresAt: v.number() }),
  handler: async (ctx, { uploadId, first, photos, access }) => {
    const { upload, collection } = await requireUpload(ctx, uploadId, access);
    const names = photos.map((photo) => photo.name);
    if (!Number.isInteger(first) || first < 0 || first !== upload.sent || !photos.length || photos.length > BATCH_PHOTOS || first + photos.length > upload.photos
      || new Set(names).size !== names.length || !photos.every(({ name, size }) => PHOTO_NAME.test(name) && Number.isInteger(size) && size >= 0 && size <= MAX_PHOTO_BYTES)) {
      throw new Error("Invalid batch");
    }
    const batches = await ctx.db.query("uploadBatches").withIndex("by_upload", (q) => q.eq("uploadId", uploadId)).collect();
    const waiting = batches.find((batch) => batch.status === "staging");
    if (waiting?.staging) {
      const { first: waitingFirst, sizes, expiresAt } = waiting.staging;
      if (expiresAt <= Date.now()) throw new ConvexError("These upload links expired. Wait a moment, then add the photos again.");
      if (waitingFirst !== first || waiting.names.length !== photos.length ||
        photos.some((photo, index) => photo.name !== waiting.names[index] || photo.size !== sizes[index])) {
        throw new ConvexError("This upload already has different photos waiting. Add the original files again to continue.");
      }
      return { batchId: waiting._id, collectionId: collection._id, expiresAt };
    }
    if (batches.some((batch) => batch.names.some((name) => names.includes(name)))) throw new Error("Photos already submitted");
    if (collection.createdBy) {
      await reservePhotos(ctx, collection.createdBy, photos.length,
        (credit) => access ? "Uploads are paused because the gallery owner’s balance has run out. Ask the owner to top up." : `Your balance ran out (${formatMoney(credit)} left). Top up, then add ${upload.name} again to continue.`);
    }
    const expiresAt = Date.now() + STAGING_URL_LIFETIME_MS;
    const batchId = await ctx.db.insert("uploadBatches", {
      collectionId: collection._id, uploadId, names,
      staging: { first, sizes: photos.map((photo) => photo.size), expiresAt, reservedBy: collection.createdBy },
      keepAllPhotos: collection.crowdsource ?? false, status: "staging", attempts: 0,
    });
    return { batchId, collectionId: collection._id, expiresAt };
  },
});

/** The server checks these immutable files in R2; the browser cannot substitute filenames when finishing. */
export const getStagingBatch = query({
  args: { id: v.id("uploadBatches"), access: v.optional(guestAccess) },
  returns: v.object({
    batchId: v.id("uploadBatches"), collectionId: v.id("collections"), uploadId: v.id("uploads"),
    names: v.array(v.string()), sizes: v.array(v.number()), expiresAt: v.number(), status: batchStatus,
  }),
  handler: async (ctx, { id, access }) => {
    const batch = await ctx.db.get(id);
    if (!batch?.staging) throw new ConvexError("Upload batch not found.");
    await requireUpload(ctx, batch.uploadId, access);
    return {
      batchId: id, collectionId: batch.collectionId, uploadId: batch.uploadId, names: batch.names,
      sizes: batch.staging.sizes, expiresAt: batch.staging.expiresAt, status: batch.status,
    };
  },
});

/** Only a trusted server that verified the R2 writes may spend the hold and hand the batch to processing. */
export const commitBatchForService = mutation({
  args: { id: v.id("uploadBatches"), serviceToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, serviceToken }) => {
    requireServiceToken(serviceToken);
    const batch = await ctx.db.get(id);
    if (!batch?.staging) throw new ConvexError("Upload batch not found.");
    if (batch.status !== "staging") return null;
    if (batch.staging.expiresAt <= Date.now()) throw new ConvexError("These upload links expired. Wait a moment, then add the photos again.");
    const upload = await ctx.db.get(batch.uploadId);
    const collection = await ctx.db.get(batch.collectionId);
    if (!upload || !collection) throw new ConvexError("Upload not found.");
    requireActiveCollection(collection);
    if (upload.contributorKey && (!collection.crowdsource || !canAccessGallery(collection, collection.shareToken))) {
      throw new ConvexError("Guest uploads are turned off or this gallery is offline.");
    }
    if (batch.staging.reservedBy) await releasePhotos(ctx, batch.staging.reservedBy, batch.names.length);
    if (collection.createdBy) {
      await charge(ctx, { userId: collection.createdBy, reason: "photos", collectionId: collection._id, sourceId: id },
        batch.names.length * PRICES.photo, () => "Uploads are paused because the gallery owner’s balance has run out.");
    }
    await ctx.db.patch(id, { status: "pending" });
    await ctx.db.patch(upload._id, { sent: batch.staging.first + batch.names.length });
    if (collection.status !== "processing") await ctx.db.patch(collection._id, { status: "processing" });
    await ctx.scheduler.runAfter(0, internal.uploads.dispatch, {});
    return null;
  },
});

/** Expired URLs get a clock margin before deleting storage; released holds must never leave usable URLs behind. */
export const expiredStagingBatch = internalQuery({
  args: { id: v.id("uploadBatches") },
  returns: v.union(v.null(), v.object({ collectionId: v.id("collections"), names: v.array(v.string()) })),
  handler: async (ctx, { id }) => {
    const batch = await ctx.db.get(id);
    return batch && (batch.status === "staging" || batch.refundPending) && batch.staging && batch.staging.expiresAt + STAGING_CLEANUP_GRACE <= Date.now()
      ? { collectionId: batch.collectionId, names: batch.names } : null;
  },
});

/** Storage cleanup calls this only after deletion succeeded. Repeated cleanup cannot release the same hold twice. */
export const releaseExpiredBatch = internalMutation({
  args: { id: v.id("uploadBatches") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const batch = await ctx.db.get(id);
    if (!batch?.staging || batch.staging.expiresAt + STAGING_CLEANUP_GRACE > Date.now()) return null;
    if (batch.status === "staging") {
      if (batch.staging.reservedBy) await releasePhotos(ctx, batch.staging.reservedBy, batch.names.length);
      await ctx.db.delete(id);
    } else if (batch.refundPending) {
      await returnPhotosNow(ctx, batch, batch.refundPending);
      await ctx.db.patch(id, { refundPending: undefined });
    }
    return null;
  },
});

export const list = query({
  args: { collectionId: v.id("collections"), access: v.optional(guestAccess) },
  returns: v.array(v.object({ _id: v.id("uploads"), _creationTime: v.number(), ...uploadFields })),
  handler: async (ctx, { collectionId, access }) => {
    if (access) await requireUploadCollection(ctx, collectionId, access);
    else await requireCollectionOwner(ctx, collectionId);
    return access
      ? ctx.db.query("uploads").withIndex("by_contributor", (q) => q.eq("collectionId", collectionId).eq("contributorKey", access.contributorKey)).order("desc").collect()
      : ctx.db.query("uploads").withIndex("by_collection", (q) => q.eq("collectionId", collectionId)).order("desc").collect();
  },
});

/** A batch's photos for its worker: each one's name, where it was uploaded, and where it goes in the gallery. */
export const getBatchForService = query({
  args: { id: v.id("uploadBatches"), serviceToken: v.string() },
  returns: v.union(v.null(), v.object({
    collectionId: v.id("collections"),
    status: batchStatus,
    attempt: v.number(),
    keepAllPhotos: v.boolean(),
    photos: v.array(v.object({ name: v.string(), source: v.string(), key: v.string() })),
  })),
  handler: async (ctx, { id, serviceToken }) => {
    requireServiceToken(serviceToken);
    const batch = await ctx.db.get(id);
    if (!batch) return null;
    const { collectionId, uploadId } = batch;
    return {
      collectionId,
      status: batch.status,
      attempt: batch.attempts,
      keepAllPhotos: batch.keepAllPhotos ?? false,
      photos: batch.names.map((name) => ({ name, source: stagingKey(collectionId, batch.staging ? batch._id : uploadId, name), key: photoKey(collectionId, uploadId, name) })),
    };
  },
});

/** A worker's result: the photos it kept, by name, and their bytes with thumbnails. The rest are refunded. */
export const completeBatchForService = mutation({
  args: { id: v.id("uploadBatches"), saved: v.array(v.string()), savedBytes: v.number(), serviceToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, saved, savedBytes, serviceToken }) => {
    requireServiceToken(serviceToken);
    const batch = await ctx.db.get(id);
    // The first result counts: a batch retried after its worker went quiet may still hear from that worker.
    if (!batch || (batch.status !== "pending" && batch.status !== "running")) return null;
    const kept = batch.names.filter((name) => saved.includes(name));
    await ctx.db.patch(id, { status: "done" });
    await returnPhotos(ctx, batch, batch.names.length - kept.length);
    await countProcessed(ctx, batch, { saved: kept.length });

    const collection = (await ctx.db.get(batch.collectionId))!;
    const previews = collection.previewImages ?? [];
    await ctx.db.patch(collection._id, {
      imagesCount: collection.imagesCount + kept.length,
      previewImages: [...previews, ...kept.map((name) => photoKey(batch.collectionId, batch.uploadId, name))].slice(0, 50),
      // Galleries from before sizes were recorded get their total from the thumbnail backfill; adding one batch's
      // bytes to nothing would make their storage look tiny and their extensions nearly free.
      ...(collection.storedBytes === undefined ? {} : { storedBytes: collection.storedBytes + savedBytes }),
    });
    await finishIfIdle(ctx, batch.collectionId);
    await ctx.scheduler.runAfter(0, internal.uploads.dispatch, {});
    await ctx.scheduler.runAfter(0, internal.uploads.merge, { collectionId: batch.collectionId });
    return null;
  },
});

/**
 * A worker that hit an error: the batch goes back in the queue right away, or is given up after its last try.
 * `attempt` is the try the worker was given, so a worker that was already replaced can't reset its replacement.
 */
export const failBatchForService = mutation({
  args: { id: v.id("uploadBatches"), attempt: v.number(), serviceToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, attempt, serviceToken }) => {
    requireServiceToken(serviceToken);
    const batch = await ctx.db.get(id);
    if (batch?.status !== "running" || batch.attempts !== attempt) return null;
    await retryOrGiveUp(ctx, batch);
    await ctx.scheduler.runAfter(0, internal.uploads.dispatch, {});
    return null;
  },
});

/** Claims batches for free workers. Each slot goes to the oldest batch of the gallery with the fewest running, so galleries take turns. */
export const claim = internalMutation({
  args: {},
  returns: v.array(v.id("uploadBatches")),
  handler: async (ctx) => {
    const running = await batchesWith(ctx, "running").collect();
    // Galleries with batches waiting are processing; each one's oldest few are enough to fill the free slots.
    const galleries = await ctx.db.query("collections").withIndex("by_status", (q) => q.eq("status", "processing")).collect();
    const pending = (await Promise.all(galleries.map((gallery) => batchesIn(ctx, gallery._id, "pending").take(MAX_RUNNING_BATCHES))))
      .flat()
      .sort((a, b) => a._creationTime - b._creationTime);
    const load = new Map<Id<"collections">, number>();
    for (const batch of running) load.set(batch.collectionId, (load.get(batch.collectionId) ?? 0) + 1);
    const busy = (batch: Doc<"uploadBatches">) => load.get(batch.collectionId) ?? 0;

    const claimed: Id<"uploadBatches">[] = [];
    while (running.length + claimed.length < MAX_RUNNING_BATCHES && pending.length) {
      const next = pending.reduce((best, batch, index) => (busy(batch) < busy(pending[best]!) ? index : best), 0);
      const [batch] = pending.splice(next, 1);
      load.set(batch!.collectionId, busy(batch!) + 1);
      await ctx.db.patch(batch!._id, { status: "running", startedAt: Date.now(), attempts: batch!.attempts + 1 });
      claimed.push(batch!._id);
    }
    return claimed;
  },
});

/** Hands claimed batches to workers. A batch the worker service didn't accept goes back in the queue. */
export const dispatch = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const claimed = await ctx.runMutation(internal.uploads.claim, {});
    await Promise.all(claimed.map(async (id) => {
      if (!(await callWorker("/api/process-batch", { batch_id: id }))) await ctx.runMutation(internal.uploads.release, { id });
    }));
    return null;
  },
});

/**
 * Puts back a batch the worker service didn't accept, without using up one of its tries: while the service is down
 * or redeploying, batches wait for it (recover tries again every few minutes) instead of being given up.
 */
export const release = internalMutation({
  args: { id: v.id("uploadBatches") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const batch = await ctx.db.get(id);
    if (batch?.status === "running") await ctx.db.patch(id, { status: "pending", startedAt: undefined, attempts: batch.attempts - 1 });
    return null;
  },
});

/** Starts a merge of the gallery's finished batches when one is due, and returns them; null when it isn't due. */
export const claimMerge = internalMutation({
  args: { collectionId: v.id("collections") },
  returns: v.union(v.null(), v.array(v.id("uploadBatches"))),
  handler: async (ctx, { collectionId }) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.mergingSince) return null;
    const done = await batchesIn(ctx, collectionId, "done").take(500);
    if (!done.length) return null;
    // While more batches are processing, wait until enough have finished to be worth a merge.
    if (done.length < MERGE_EVERY && (await hasWork(ctx, collectionId))) return null;
    await ctx.db.patch(collectionId, { mergingSince: Date.now() });
    return done.map((batch) => batch._id);
  },
});

export const merge = internalAction({
  args: { collectionId: v.id("collections") },
  returns: v.null(),
  handler: async (ctx, { collectionId }) => {
    const batchIds = await ctx.runMutation(internal.uploads.claimMerge, { collectionId });
    if (batchIds && !(await callWorker("/api/merge-faces", { collection_id: collectionId, batch_ids: batchIds }))) {
      await ctx.runMutation(internal.uploads.endMerge, { collectionId });
    }
    return null;
  },
});

export const endMerge = internalMutation({
  args: { collectionId: v.id("collections") },
  returns: v.null(),
  handler: async (ctx, { collectionId }) => {
    await ctx.db.patch(collectionId, { mergingSince: undefined });
    return null;
  },
});

/** A merge worker's result: these batches' faces are now in the gallery's face index. */
export const facesMergedForService = mutation({
  args: { collectionId: v.id("collections"), batchIds: v.array(v.id("uploadBatches")), serviceToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { collectionId, batchIds, serviceToken }) => {
    requireServiceToken(serviceToken);
    for (const id of batchIds) {
      const batch = await ctx.db.get(id);
      if (batch?.status === "done") await ctx.db.patch(id, { status: "merged" });
    }
    await ctx.db.patch(collectionId, { mergingSince: undefined });
    // More batches may have finished during the merge.
    await ctx.scheduler.runAfter(0, internal.uploads.merge, { collectionId });
    return null;
  },
});

/** Runs every few minutes: retries batches and merges whose workers went quiet, and restarts work a lost request left waiting. */
export const recover = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STALLED_AFTER;
    const cleanup = [
      ...await batchesWith(ctx, "staging").collect(),
      ...await ctx.db.query("uploadBatches").withIndex("by_refund_pending", (q) => q.gt("refundPending", 0)).collect(),
    ];
    for (const batch of cleanup) {
      if (batch.staging && batch.staging.expiresAt + STAGING_CLEANUP_GRACE <= Date.now()) {
        await ctx.scheduler.runAfter(0, internal.stagingStorage.cleanup, { id: batch._id });
      }
    }
    for (const batch of await batchesWith(ctx, "running").collect()) {
      if ((batch.startedAt ?? 0) < cutoff) await retryOrGiveUp(ctx, batch);
    }
    const stalledMerges = await ctx.db.query("collections")
      .withIndex("by_merging_since", (q) => q.gt("mergingSince", 0).lt("mergingSince", cutoff)).collect();
    for (const collection of stalledMerges) await ctx.db.patch(collection._id, { mergingSince: undefined });

    if (await batchesWith(ctx, "pending").first()) await ctx.scheduler.runAfter(0, internal.uploads.dispatch, {});
    const waiting = new Set((await batchesWith(ctx, "done").take(500)).map((batch) => batch.collectionId));
    for (const collectionId of waiting) await ctx.scheduler.runAfter(0, internal.uploads.merge, { collectionId });
    return null;
  },
});

async function retryOrGiveUp(ctx: MutationCtx, batch: Doc<"uploadBatches">) {
  if (batch.attempts < MAX_ATTEMPTS) {
    await ctx.db.patch(batch._id, { status: "pending", startedAt: undefined });
    return;
  }
  await ctx.db.patch(batch._id, { status: "failed" });
  await returnPhotos(ctx, batch, batch.names.length);
  await countProcessed(ctx, batch, { failed: batch.names.length });
  await finishIfIdle(ctx, batch.collectionId);
}

async function countProcessed(ctx: MutationCtx, batch: Doc<"uploadBatches">, { saved = 0, failed = 0 }) {
  const upload = await ctx.db.get(batch.uploadId);
  if (!upload) return;
  await ctx.db.patch(upload._id, {
    processed: upload.processed + batch.names.length,
    saved: upload.saved + saved,
    failed: upload.failed + failed,
  });
}

/** Marks the gallery complete once none of its batches are waiting or processing. */
async function finishIfIdle(ctx: MutationCtx, collectionId: Id<"collections">) {
  if (!(await hasWork(ctx, collectionId))) await ctx.db.patch(collectionId, { status: "complete" });
}

async function hasWork(ctx: MutationCtx, collectionId: Id<"collections">) {
  return Boolean(await batchesIn(ctx, collectionId, "pending").first() ?? await batchesIn(ctx, collectionId, "running").first());
}

const batchesWith = (ctx: MutationCtx, status: Doc<"uploadBatches">["status"]) =>
  ctx.db.query("uploadBatches").withIndex("by_status", (q) => q.eq("status", status));

const batchesIn = (ctx: MutationCtx, collectionId: Id<"collections">, status: Doc<"uploadBatches">["status"]) =>
  ctx.db.query("uploadBatches").withIndex("by_collection_and_status", (q) => q.eq("collectionId", collectionId).eq("status", status));

/** Asks the processing service to start work. False when it didn't accept, so the work goes back to wait. */
async function callWorker(path: string, body: object) {
  const apiUrl = process.env.PYTHON_API_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  if (!apiUrl || !serviceToken) {
    console.error("PYTHON_API_URL and SERVICE_TOKEN must be set to process photos");
    return false;
  }
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
  return Boolean(response?.ok);
}

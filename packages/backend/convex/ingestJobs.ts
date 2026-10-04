import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireActiveCollection, requireCollectionOwner, requireServiceToken } from "./authz";
import { settleIngest } from "./balances";

const jobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("failed"),
  v.literal("completed"),
  v.literal("canceled")
);

function newJob(collectionId: Id<"collections">, fileKey: string, filename: string, createdAt: number) {
  return {
    collectionId,
    fileKey,
    filename,
    status: "pending" as const,
    processedImages: 0,
    createdAt,
  };
}

export const get = query({
  args: { id: v.id("ingestJobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return null;
    await requireCollectionOwner(ctx, job.collectionId);
    return job;
  },
});

export const getForService = query({
  args: { id: v.id("ingestJobs"), serviceToken: v.string() },
  handler: async (ctx, { id, serviceToken }) => {
    requireServiceToken(serviceToken);
    return ctx.db.get(id);
  },
});

/** Queues an uploaded ZIP and starts it right away unless another upload of this gallery is running. */
export const create = mutation({
  args: { collectionId: v.id("collections"), fileKey: v.string(), filename: v.string() },
  handler: async (ctx, args) => {
    const { collection } = await requireCollectionOwner(ctx, args.collectionId);
    requireActiveCollection(collection);
    const id = await ctx.db.insert("ingestJobs", newJob(args.collectionId, args.fileKey, args.filename, Date.now()));
    await ctx.scheduler.runAfter(0, internal.ingest.dispatchNextForCollection, { collectionId: args.collectionId });
    return id;
  },
});

export const updateProgress = mutation({
  args: {
    id: v.id("ingestJobs"),
    serviceToken: v.string(),
    totalImages: v.optional(v.number()),
    processedImages: v.optional(v.number()),
    // Jobs finish only through markCompleted or markFailed, which settle what the upload reserved.
    status: v.optional(v.literal("running")),
    workId: v.optional(v.string()),
  },
  handler: async (ctx, { id, serviceToken, ...values }) => {
    requireServiceToken(serviceToken);
    await ctx.db.patch(id, { ...values, ...(values.status === "running" ? { startedAt: Date.now() } : {}) });
  },
});

/** Fails a job, returns what it reserved, and starts the gallery's next upload. */
async function failJob(ctx: MutationCtx, id: Id<"ingestJobs">, error: string) {
  const existing = await ctx.db.get(id);
  if (!existing || existing.status === "completed" || existing.status === "canceled") return;
  await ctx.db.patch(id, { status: "failed", error, finishedAt: Date.now() });
  await settleIngest(ctx, existing, 0);
  await ctx.scheduler.runAfter(0, internal.ingest.dispatchNextForCollection, { collectionId: existing.collectionId });
}

export const markFailed = mutation({
  args: { id: v.id("ingestJobs"), error: v.string(), serviceToken: v.string() },
  handler: async (ctx, { id, error, serviceToken }) => {
    requireServiceToken(serviceToken);
    await failJob(ctx, id, error);
  },
});

/** For a job the processing service never received, so it isn't left running and blocking the gallery's uploads. */
export const markUndelivered = internalMutation({
  args: { id: v.id("ingestJobs") },
  handler: (ctx, { id }) => failJob(ctx, id, "Processing didn't start. Try again in a minute."),
});

export const markCompleted = mutation({
  args: {
    id: v.id("ingestJobs"),
    processedImages: v.number(),
    // Photos kept (those with faces) and their bytes with thumbnails
    savedImages: v.number(),
    savedBytes: v.number(),
    serviceToken: v.string(),
  },
  handler: async (ctx, { id, processedImages, savedImages, savedBytes, serviceToken }) => {
    requireServiceToken(serviceToken);
    const existing = await ctx.db.get(id);
    // Modal can replay an input after its completion write already succeeded.
    if (!existing || existing.status === "completed" || existing.status === "canceled") return;
    await ctx.db.patch(id, { status: "completed", processedImages, savedImages, finishedAt: Date.now() });
    await settleIngest(ctx, existing, savedImages);
    const collection = await ctx.db.get(existing.collectionId);
    // Galleries from before sizes were recorded get their total from the thumbnail backfill; adding one upload's
    // bytes to nothing would make their storage look tiny and their extensions nearly free.
    if (collection?.storedBytes !== undefined) await ctx.db.patch(collection._id, { storedBytes: collection.storedBytes + savedBytes });
    const job = await ctx.db.get(id);
    if (job) await ctx.scheduler.runAfter(0, internal.ingest.dispatchNextForCollection, { collectionId: job.collectionId });
  },
});

export const listByCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    await requireCollectionOwner(ctx, collectionId);
    return ctx.db
      .query("ingestJobs")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .order("desc")
      .collect();
  },
});

export const claimNextForCollection = internalMutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const running = await ctx.db
      .query("ingestJobs")
      .withIndex("by_collection_and_status", (q) =>
        q.eq("collectionId", collectionId).eq("status", "running")
      )
      .first();
    if (running) return null;

    const next = await ctx.db
      .query("ingestJobs")
      .withIndex("by_collection_and_status", (q) =>
        q.eq("collectionId", collectionId).eq("status", "pending")
      )
      .order("asc")
      .first();
    if (!next) return null;

    await ctx.db.patch(next._id, { status: "running", startedAt: Date.now(), error: undefined, attempt: (next.attempt ?? 0) + 1 });
    return { _id: next._id, collectionId: next.collectionId, fileKey: next.fileKey, filename: next.filename };
  },
});

export const retry = mutation({
  args: { id: v.id("ingestJobs") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return;
    await requireCollectionOwner(ctx, job.collectionId);
    if (job.status !== "failed" && job.status !== "canceled") return;
    await ctx.db.patch(id, {
      status: "pending",
      error: undefined,
      processedImages: 0,
      startedAt: undefined,
      finishedAt: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.ingest.dispatchNextForCollection, { collectionId: job.collectionId });
  },
});

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireCollectionOwner, requirePhotoCapacity, requireServiceToken } from "./authz";

const jobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("failed"),
  v.literal("completed"),
  v.literal("canceled")
);

function newJob(collectionId: any, fileKey: string, filename: string, createdAt: number) {
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

export const create = mutation({
  args: { collectionId: v.id("collections"), fileKey: v.string(), filename: v.string() },
  handler: async (ctx, args) => {
    const { collection } = await requireCollectionOwner(ctx, args.collectionId);
    requirePhotoCapacity(collection);
    return ctx.db.insert("ingestJobs", newJob(args.collectionId, args.fileKey, args.filename, Date.now()));
  },
});

export const createBatch = mutation({
  args: {
    jobs: v.array(
      v.object({ collectionId: v.id("collections"), fileKey: v.string(), filename: v.string() })
    ),
  },
  handler: async (ctx, { jobs }) => {
    if (!jobs.length || jobs.length > 20) throw new Error("Upload 1–20 archives at a time");
    for (const collectionId of new Set(jobs.map((job) => job.collectionId))) {
      const { collection } = await requireCollectionOwner(ctx, collectionId);
      requirePhotoCapacity(collection);
    }
    const now = Date.now();
    return Promise.all(
      jobs.map((job) =>
        ctx.db.insert("ingestJobs", newJob(job.collectionId, job.fileKey, job.filename, now))
      )
    );
  },
});

export const updateProgress = mutation({
  args: {
    id: v.id("ingestJobs"),
    serviceToken: v.string(),
    totalImages: v.optional(v.number()),
    processedImages: v.optional(v.number()),
    status: v.optional(jobStatus),
    error: v.optional(v.string()),
    workId: v.optional(v.string()),
  },
  handler: async (ctx, { id, serviceToken, ...values }) => {
    requireServiceToken(serviceToken);
    const updates: Record<string, unknown> = { ...values };
    if (values.status === "running") updates.startedAt = Date.now();
    if (["completed", "failed", "canceled"].includes(values.status ?? "")) {
      updates.finishedAt = Date.now();
    }
    await ctx.db.patch(id, updates);
  },
});

export const markFailed = mutation({
  args: { id: v.id("ingestJobs"), error: v.string(), serviceToken: v.string() },
  handler: async (ctx, { id, error, serviceToken }) => {
    requireServiceToken(serviceToken);
    const existing = await ctx.db.get(id);
    if (!existing || existing.status === "completed" || existing.status === "canceled") return;
    await ctx.db.patch(id, { status: "failed", error, finishedAt: Date.now() });
    const job = await ctx.db.get(id);
    if (job) await ctx.scheduler.runAfter(0, internal.ingest.dispatchNextForCollection, { collectionId: job.collectionId });
  },
});

export const markCompleted = mutation({
  args: { id: v.id("ingestJobs"), processedImages: v.number(), serviceToken: v.string() },
  handler: async (ctx, { id, processedImages, serviceToken }) => {
    requireServiceToken(serviceToken);
    const existing = await ctx.db.get(id);
    // Modal can replay an input after its completion write already succeeded.
    if (!existing || existing.status === "completed" || existing.status === "canceled") return;
    await ctx.db.patch(id, { status: "completed", processedImages, finishedAt: Date.now() });
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

    await ctx.db.patch(next._id, { status: "running", startedAt: Date.now(), error: undefined });
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

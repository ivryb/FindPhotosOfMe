import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { id: v.id("ingestJobs") },
  returns: v.union(
    v.object({
      _id: v.id("ingestJobs"),
      _creationTime: v.number(),
      collectionId: v.id("collections"),
      fileKey: v.string(),
      filename: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("failed"),
        v.literal("completed"),
        v.literal("canceled")
      ),
      totalImages: v.optional(v.number()),
      processedImages: v.number(),
      error: v.optional(v.string()),
      workId: v.optional(v.string()),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      finishedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    fileKey: v.string(),
    filename: v.string(),
  },
  returns: v.id("ingestJobs"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("ingestJobs", {
      collectionId: args.collectionId,
      fileKey: args.fileKey,
      filename: args.filename,
      status: "pending" as const,
      totalImages: undefined,
      processedImages: 0,
      error: undefined,
      workId: undefined,
      createdAt: now,
      startedAt: undefined,
      finishedAt: undefined,
    });
    return id;
  },
});

export const createBatch = mutation({
  args: {
    jobs: v.array(
      v.object({
        collectionId: v.id("collections"),
        fileKey: v.string(),
        filename: v.string(),
      })
    ),
  },
  returns: v.array(v.id("ingestJobs")),
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids: any[] = [];
    for (const job of args.jobs) {
      const id = await ctx.db.insert("ingestJobs", {
        collectionId: job.collectionId,
        fileKey: job.fileKey,
        filename: job.filename,
        status: "pending" as const,
        totalImages: undefined,
        processedImages: 0,
        error: undefined,
        workId: undefined,
        createdAt: now,
        startedAt: undefined,
        finishedAt: undefined,
      });
      ids.push(id);
    }
    return ids as any;
  },
});

export const updateProgress = mutation({
  args: {
    id: v.id("ingestJobs"),
    totalImages: v.optional(v.number()),
    processedImages: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("failed"),
        v.literal("completed"),
        v.literal("canceled")
      )
    ),
    error: v.optional(v.string()),
    workId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.totalImages !== undefined) updates.totalImages = args.totalImages;
    if (args.processedImages !== undefined)
      updates.processedImages = args.processedImages;
    if (args.status !== undefined) updates.status = args.status;
    if (args.error !== undefined) updates.error = args.error;
    if (args.workId !== undefined) updates.workId = args.workId;

    if (args.status === "running") updates.startedAt = Date.now();
    if (
      args.status === "completed" ||
      args.status === "failed" ||
      args.status === "canceled"
    )
      updates.finishedAt = Date.now();

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const markFailed = mutation({
  args: { id: v.id("ingestJobs"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "failed",
      error: args.error,
      finishedAt: Date.now(),
    });
    return null;
  },
});

export const markCompleted = mutation({
  args: { id: v.id("ingestJobs"), processedImages: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "completed",
      processedImages: args.processedImages,
      finishedAt: Date.now(),
    });
    return null;
  },
});

export const listByCollection = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(
    v.object({
      _id: v.id("ingestJobs"),
      _creationTime: v.number(),
      collectionId: v.id("collections"),
      fileKey: v.string(),
      filename: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("failed"),
        v.literal("completed"),
        v.literal("canceled")
      ),
      totalImages: v.optional(v.number()),
      processedImages: v.number(),
      error: v.optional(v.string()),
      workId: v.optional(v.string()),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      finishedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("ingestJobs")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId)
      )
      .order("desc")
      .collect();
    return items;
  },
});

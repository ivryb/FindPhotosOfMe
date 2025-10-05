import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Get a search request by ID.
 */
export const get = query({
  args: { id: v.id("searchRequests") },
  returns: v.union(
    v.object({
      _id: v.id("searchRequests"),
      _creationTime: v.number(),
      collectionId: v.id("collections"),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("error")
      ),
      imagesFound: v.array(v.string()),
      totalImages: v.optional(v.number()),
      processedImages: v.optional(v.number()),
      telegramChatId: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const searchRequest = await ctx.db.get(args.id);
    return searchRequest;
  },
});

/**
 * Create a new search request.
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    telegramChatId: v.optional(v.string()),
  },
  returns: v.id("searchRequests"),
  handler: async (ctx, args) => {
    // Verify collection exists
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const searchRequestId = await ctx.db.insert("searchRequests", {
      collectionId: args.collectionId,
      status: "pending" as const,
      imagesFound: [],
      telegramChatId: args.telegramChatId,
    });

    return searchRequestId;
  },
});

/**
 * Update search request with progress and results.
 */
export const update = mutation({
  args: {
    id: v.id("searchRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("error")
    ),
    imagesFound: v.optional(v.array(v.string())),
    totalImages: v.optional(v.number()),
    processedImages: v.optional(v.number()),
    telegramChatId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };

    if (args.imagesFound !== undefined) {
      updates.imagesFound = args.imagesFound;
    }
    if (args.totalImages !== undefined) {
      updates.totalImages = args.totalImages;
    }
    if (args.processedImages !== undefined) {
      updates.processedImages = args.processedImages;
    }
    if (args.telegramChatId !== undefined) {
      updates.telegramChatId = args.telegramChatId;
    }

    await ctx.db.patch(args.id, updates);

    if (args.status === "complete") {
      // If telegram chat is known, schedule result delivery
      await ctx.scheduler.runAfter(0, internal.telegram.sendResults, {
        searchRequestId: args.id,
      });
    }
    return null;
  },
});

/**
 * Get search requests for a collection.
 */
export const listByCollection = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(
    v.object({
      _id: v.id("searchRequests"),
      _creationTime: v.number(),
      collectionId: v.id("collections"),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("error")
      ),
      imagesFound: v.array(v.string()),
      totalImages: v.optional(v.number()),
      processedImages: v.optional(v.number()),
      telegramChatId: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const searchRequests = await ctx.db
      .query("searchRequests")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId)
      )
      .order("desc")
      .collect();

    return searchRequests;
  },
});

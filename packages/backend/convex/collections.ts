import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get a collection by ID.
 */
export const get = query({
  args: { id: v.id("collections") },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.string(),
      subdomain: v.string(),
      status: v.union(
        v.literal("not_started"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("error")
      ),
      imagesCount: v.number(),
      previewImages: v.optional(v.array(v.string())),
      createdBy: v.optional(v.string()),
      telegramBotToken: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    return collection;
  },
});

/**
 * Create a new collection.
 */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    subdomain: v.string(),
    createdBy: v.optional(v.string()),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const collectionId = await ctx.db.insert("collections", {
      title: args.title,
      description: args.description,
      subdomain: args.subdomain,
      status: "not_started" as const,
      imagesCount: 0,
      previewImages: [],
      createdBy: args.createdBy,
    });
    return collectionId;
  },
});

/**
 * Update collection status and image count.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("collections"),
    status: v.union(
      v.literal("not_started"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("error")
    ),
    imagesCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.imagesCount !== undefined) {
      updates.imagesCount = args.imagesCount;
    }
    await ctx.db.patch(args.id, updates);
    return null;
  },
});

/**
 * Increment collection image count.
 */
export const incrementImages = mutation({
  args: {
    id: v.id("collections"),
    increment: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) {
      throw new Error("Collection not found");
    }
    await ctx.db.patch(args.id, {
      imagesCount: collection.imagesCount + args.increment,
    });
    return null;
  },
});

/**
 * List all collections.
 */
export const getAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.string(),
      subdomain: v.string(),
      status: v.union(
        v.literal("not_started"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("error")
      ),
      imagesCount: v.number(),
      previewImages: v.optional(v.array(v.string())),
      createdBy: v.optional(v.string()),
      telegramBotToken: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const collections = await ctx.db
      .query("collections")
      .order("desc")
      .collect();
    return collections;
  },
});

export const getBySubdomain = query({
  args: { subdomain: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.string(),
      subdomain: v.string(),
      status: v.union(
        v.literal("not_started"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("error")
      ),
      imagesCount: v.number(),
      previewImages: v.optional(v.array(v.string())),
      createdBy: v.optional(v.string()),
      telegramBotToken: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db
      .query("collections")
      .filter((q) => q.eq(q.field("subdomain"), args.subdomain))
      .first();
    return collection;
  },
});

export const deleteCollection = mutation({
  args: { id: v.id("collections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    subdomain: v.string(),
    title: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      subdomain: args.subdomain,
      title: args.title,
      description: args.description,
    });
    return null;
  },
});

/**
 * Set or clear a Telegram bot token for a collection and schedule webhook setup.
 */
export const setTelegramBotToken = mutation({
  args: {
    id: v.id("collections"),
    token: v.union(v.string(), v.literal("")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const tokenToStore = args.token.trim();

    await ctx.db.patch(args.id, {
      telegramBotToken: tokenToStore.length > 0 ? tokenToStore : undefined,
    });

    // Schedule webhook setup only if a token is provided
    if (tokenToStore.length > 0) {
      await ctx.scheduler.runAfter(0, internal.telegram.setWebhook, {
        collectionId: args.id,
      });
    }

    return null;
  },
});

/**
 * Set preview images (first 50) for a collection.
 */
export const setPreviewImages = mutation({
  args: {
    id: v.id("collections"),
    previewImages: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      previewImages: args.previewImages.slice(0, 50),
    });
    return null;
  },
});

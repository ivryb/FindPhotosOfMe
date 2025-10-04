import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
      createdBy: v.optional(v.string()),
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
      createdBy: v.optional(v.string()),
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

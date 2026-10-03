import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  requireActiveCollection,
  requireCollectionOwner,
  requireServiceToken,
  requireUser,
} from "./authz";

const searchStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("complete"),
  v.literal("error")
);

export const create = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const [user, collection] = await Promise.all([requireUser(ctx), ctx.db.get(collectionId)]);
    if (!collection || collection.status !== "complete") throw new Error("Event is not ready");
    requireActiveCollection(collection);
    return ctx.db.insert("searchRequests", {
      collectionId,
      requesterId: user._id,
      status: "pending",
      imagesFound: [],
    });
  },
});

export const createForService = mutation({
  args: {
    collectionId: v.id("collections"),
    telegramChatId: v.string(),
    fileId: v.string(),
    messageId: v.number(),
    serviceToken: v.string(),
  },
  handler: async (ctx, { collectionId, telegramChatId, fileId, messageId, serviceToken }) => {
    requireServiceToken(serviceToken);
    const collection = await ctx.db.get(collectionId);
    if (!collection || collection.status !== "complete") throw new Error("Event is not ready");
    requireActiveCollection(collection);
    const requestId = await ctx.db.insert("searchRequests", {
      collectionId,
      status: "pending",
      imagesFound: [],
      telegramChatId,
    });
    // Persist the request and schedule its continuation atomically before acknowledging Telegram.
    await ctx.scheduler.runAfter(0, internal.telegram.searchAndReply, {
      requestId, fileId, messageId,
    });
    return requestId;
  },
});

export const get = query({
  args: { id: v.id("searchRequests") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(id);
    if (!request || request.requesterId !== user._id) return null;
    return request;
  },
});

export const getForService = query({
  args: { id: v.id("searchRequests"), serviceToken: v.string() },
  handler: async (ctx, { id, serviceToken }) => {
    requireServiceToken(serviceToken);
    return ctx.db.get(id);
  },
});

export const updateForService = mutation({
  args: {
    id: v.id("searchRequests"),
    serviceToken: v.string(),
    status: searchStatus,
    imagesFound: v.optional(v.array(v.string())),
    totalImages: v.optional(v.number()),
    processedImages: v.optional(v.number()),
  },
  handler: async (ctx, { id, serviceToken, ...values }) => {
    requireServiceToken(serviceToken);
    await ctx.db.patch(id, values);
  },
});

export const authorizeImages = query({
  args: { id: v.id("searchRequests"), keys: v.array(v.string()) },
  handler: async (ctx, { id, keys }) => {
    if (keys.length > 200) throw new Error("Too many images requested");
    const user = await requireUser(ctx);
    const request = await ctx.db.get(id);
    if (!request || request.requesterId !== user._id || request.status !== "complete") {
      throw new Error("Not authorized");
    }
    const allowed = new Set(request.imagesFound);
    return keys.every((key) => allowed.has(key));
  },
});

export const listByCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    await requireCollectionOwner(ctx, collectionId);
    return ctx.db
      .query("searchRequests")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .order("desc")
      .collect();
  },
});

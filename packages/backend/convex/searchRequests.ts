import { ConvexError, v } from "convex/values";

import { authComponent } from "./auth";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  requireActiveCollection,
  requireCollectionOwner,
  requireServiceToken,
} from "./authz";
import { chargeSearch, returnSearch } from "./balances";

async function canReadRequest(ctx: QueryCtx, request: Doc<"searchRequests">) {
  // Unpublishing also closes previously shared search results. Owner searches always stay private.
  if (request.publicAccess) {
    const collection = await ctx.db.get(request.collectionId);
    if (!collection || collection.published === false) return false;
    try { requireActiveCollection(collection); } catch { return false; }
    return true;
  }
  if (!request.requesterId) return false;
  const user = await authComponent.safeGetAuthUser(ctx);
  return user?._id === request.requesterId;
}

const searchStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("complete"),
  v.literal("error")
);

export const create = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection || !collection.imagesCount) throw new ConvexError("This gallery has no photos yet");
    requireActiveCollection(collection);
    const user = await authComponent.safeGetAuthUser(ctx);
    const owner = user && (collection.createdBy === user._id ||
      (!collection.createdBy && Boolean(process.env.LEGACY_OWNER_EMAIL) && user.email === process.env.LEGACY_OWNER_EMAIL));
    if (collection.published === false && !owner) throw new ConvexError("This gallery is private");
    const requestId = await ctx.db.insert("searchRequests", {
      collectionId,
      publicAccess: owner ? undefined : true,
      requesterId: owner ? user._id : undefined,
      status: "pending",
      imagesFound: [],
    });
    await chargeSearch(ctx, collection, requestId);
    return requestId;
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
    if (!collection || collection.published === false) throw new ConvexError("This gallery is private.");
    if (!collection.imagesCount) throw new ConvexError("This gallery has no photos yet.");
    requireActiveCollection(collection);
    const requestId = await ctx.db.insert("searchRequests", {
      collectionId,
      status: "pending",
      imagesFound: [],
      telegramChatId,
    });
    await chargeSearch(ctx, collection, requestId);
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
    const request = await ctx.db.get(id);
    if (!request || !(await canReadRequest(ctx, request))) return null;
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
    error: v.optional(v.union(v.literal("no_face"), v.literal("failed"))),
  },
  handler: async (ctx, { id, serviceToken, ...values }) => {
    requireServiceToken(serviceToken);
    const existing = await ctx.db.get(id);
    // The first outcome is final: a late failure report must not hide results, or replace "no face" with "failed".
    if (!existing || existing.status === "complete" || existing.status === "error") return;
    await ctx.db.patch(id, values);
    // A search that couldn't run is given back to the gallery owner.
    if (values.status === "error") await returnSearch(ctx, existing);
  },
});

export const authorizeImages = query({
  args: { id: v.id("searchRequests"), keys: v.array(v.string()) },
  handler: async (ctx, { id, keys }) => {
    if (keys.length > 200) throw new Error("Too many images requested");
    const request = await ctx.db.get(id);
    if (!request || !(await canReadRequest(ctx, request)) || request.status !== "complete") {
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

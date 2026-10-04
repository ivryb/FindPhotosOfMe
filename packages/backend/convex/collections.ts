import { telegramWebhookSecret } from "../telegram";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import {
  internalAction,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  requireActiveCollection,
  requireCollectionOwner,
  requireServiceToken,
  requireUser,
} from "./authz";
import { balanceFor } from "./balances";
import { DAY, INCLUDED_DAYS, TRIAL_DAYS } from "./pricing";

/** What anyone with the link may see. A gallery is public once it has photos, even while more are being added. */
function publicView(collection: Doc<"collections"> | null) {
  if (!collection?.imagesCount) return null;
  try {
    requireActiveCollection(collection);
  } catch {
    return null;
  }
  return {
    _id: collection._id,
    title: collection.title,
    description: collection.description,
    subdomain: collection.subdomain,
    imagesCount: collection.imagesCount,
    previewImages: collection.previewImages ?? [],
    showAllPhotos: collection.showAllPhotos ?? true,
  };
}

const status = v.union(
  v.literal("not_started"),
  v.literal("processing"),
  v.literal("complete"),
  v.literal("error")
);

function normalizeSubdomain(value: string) {
  const subdomain = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain)) {
    throw new ConvexError("Use 3–63 lowercase letters, numbers, or hyphens");
  }
  return subdomain;
}

async function ensureSubdomainAvailable(ctx: any, subdomain: string, exceptId?: string) {
  const existing = await ctx.db
    .query("collections")
    .withIndex("by_subdomain", (q: any) => q.eq("subdomain", subdomain))
    .first();
  if (existing && existing._id !== exceptId) throw new ConvexError("That gallery address is already in use");
}

export const get = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => (await requireCollectionOwner(ctx, id)).collection,
});

export const getForService = query({
  args: { id: v.id("collections"), serviceToken: v.string() },
  handler: async (ctx, { id, serviceToken }) => {
    requireServiceToken(serviceToken);
    return ctx.db.get(id);
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: { title: v.string(), description: v.string(), subdomain: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const subdomain = normalizeSubdomain(args.subdomain);
    await ensureSubdomainAvailable(ctx, subdomain);
    // During the trial a gallery stays online for a week; the first top-up extends it.
    const { paid } = await balanceFor(ctx, user._id);
    return ctx.db.insert("collections", {
      title: args.title.trim(),
      description: args.description.trim(),
      subdomain,
      status: "not_started",
      imagesCount: 0,
      storedBytes: 0,
      expiresAt: Date.now() + (paid ? INCLUDED_DAYS : TRIAL_DAYS) * DAY,
      trial: paid ? undefined : true,
      previewImages: [],
      createdBy: user._id,
    });
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const owned = await ctx.db.query("collections").withIndex("by_created_by", (q) => q.eq("createdBy", user._id)).order("desc").collect();
    if (user.email !== process.env.LEGACY_OWNER_EMAIL) return owned;
    const unclaimed = await ctx.db.query("collections").withIndex("by_created_by", (q) => q.eq("createdBy", undefined)).order("desc").collect();
    return [...owned, ...unclaimed];
  },
});

export const getBySubdomain = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const collection = await ctx.db
      .query("collections")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
      .first();
    if (!collection) return null;
    await requireCollectionOwner(ctx, collection._id);
    return collection;
  },
});

export const getPublicBySubdomain = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const collection = await ctx.db
      .query("collections")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
      .first();
    return publicView(collection);
  },
});

export const getPublic = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => publicView(await ctx.db.get(id)),
});

export const isPublicPreview = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const rawId = key.split("/", 1)[0];
    const id = rawId ? ctx.db.normalizeId("collections", rawId) : null;
    if (!id) return false;
    const collection = await ctx.db.get(id);
    return Boolean(
      collection?.status === "complete" && collection.previewImages?.includes(key)
    );
  },
});

export const canManage = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    await requireCollectionOwner(ctx, id);
    return true;
  },
});

export const canUpload = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const { collection } = await requireCollectionOwner(ctx, id);
    requireActiveCollection(collection);
    return true;
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    subdomain: v.string(),
    title: v.string(),
    description: v.string(),
    welcomeMessage: v.optional(v.string()),
    showAllPhotos: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user, canClaimLegacy } = await requireCollectionOwner(ctx, args.id);
    const subdomain = normalizeSubdomain(args.subdomain);
    await ensureSubdomainAvailable(ctx, subdomain, args.id);
    await ctx.db.patch(args.id, {
      subdomain,
      title: args.title.trim(),
      description: args.description.trim(),
      welcomeMessage: args.welcomeMessage?.trim() || undefined,
      ...(args.showAllPhotos === undefined ? {} : { showAllPhotos: args.showAllPhotos }),
      ...(canClaimLegacy ? { createdBy: user._id } : {}),
    });
  },
});

export const deleteCollection = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    await requireCollectionOwner(ctx, id);
    const searches = await ctx.db
      .query("searchRequests")
      .withIndex("by_collection", (q) => q.eq("collectionId", id))
      .collect();
    const jobs = await ctx.db
      .query("ingestJobs")
      .withIndex("by_collection", (q) => q.eq("collectionId", id))
      .collect();
    await Promise.all([...searches, ...jobs].map((doc) => ctx.db.delete(doc._id)));
    await ctx.db.delete(id);
  },
});

export const updateStatusForService = mutation({
  args: { id: v.id("collections"), status, imagesCount: v.optional(v.number()), serviceToken: v.string() },
  handler: async (ctx, { id, serviceToken, ...updates }) => {
    requireServiceToken(serviceToken);
    await ctx.db.patch(id, updates);
  },
});

export const incrementImagesForService = mutation({
  args: { id: v.id("collections"), increment: v.number(), serviceToken: v.string() },
  handler: async (ctx, { id, increment, serviceToken }) => {
    requireServiceToken(serviceToken);
    const collection = await ctx.db.get(id);
    if (!collection) throw new Error("Collection not found");
    await ctx.db.patch(id, { imagesCount: collection.imagesCount + increment });
  },
});

/** Records a gallery's size in R2; the thumbnail backfill measures galleries made before sizes were tracked. */
export const setStoredBytesForService = mutation({
  args: { id: v.id("collections"), storedBytes: v.number(), serviceToken: v.string() },
  handler: async (ctx, { id, storedBytes, serviceToken }) => {
    requireServiceToken(serviceToken);
    await ctx.db.patch(id, { storedBytes });
  },
});

export const setPreviewImagesForService = mutation({
  args: { id: v.id("collections"), previewImages: v.array(v.string()), serviceToken: v.string() },
  handler: async (ctx, { id, previewImages, serviceToken }) => {
    requireServiceToken(serviceToken);
    await ctx.db.patch(id, { previewImages: previewImages.slice(0, 50) });
  },
});

export const storeTelegramBotToken = mutation({
  args: { id: v.id("collections"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireCollectionOwner(ctx, id);
    const value = token.trim();
    await ctx.db.patch(id, { telegramBotToken: value || undefined });
    if (value) await ctx.scheduler.runAfter(0, internal.collections.setTelegramBotToken, { id, token: value });
  },
});

export const setTelegramBotToken = internalAction({
  args: { id: v.id("collections"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    const webhookBase = process.env.TELEGRAM_WEBHOOK_BASE_URL;
    if (!webhookBase) throw new Error("TELEGRAM_WEBHOOK_BASE_URL not configured");
    const collection = await ctx.runQuery(internal.collections.getInternal, { id });
    if (!collection) throw new Error("Collection not found");
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${webhookBase}/${id}`,
          secret_token: await telegramWebhookSecret(token),
          allowed_updates: ["message"],
        }),
      }
    );
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Failed to set Telegram webhook");
  },
});

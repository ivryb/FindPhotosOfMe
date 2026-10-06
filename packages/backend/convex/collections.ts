import { telegramWebhookSecret } from "../telegram";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canAccessGallery,
  requireActiveCollection,
  requireCollectionOwner,
  requireServiceToken,
  requireUser,
} from "./authz";
import { balanceFor, releasePhotos, returnPhotosNow } from "./balances";
import { DAY, INCLUDED_DAYS, TRIAL_DAYS } from "./pricing";
import { originalPhotoKey } from "./photoKeys";
import { canReadRequest } from "./searchRequests";

/** What anyone with the link may see after the owner publishes the gallery. */
function publicView(collection: Doc<"collections"> | null, shareToken?: string) {
  if (!collection || !canAccessGallery(collection, shareToken)) return null;
  return {
    _id: collection._id,
    title: collection.title,
    description: collection.description,
    subdomain: collection.subdomain,
    imagesCount: collection.imagesCount,
    previewImages: collection.previewImages ?? [],
    showAllPhotos: collection.crowdsource || (collection.showAllPhotos ?? true),
    crowdsource: collection.crowdsource ?? false,
  };
}

/** Checked by the image proxy on every request, before it serves bytes from R2 or the edge cache. */
export const canReadPhoto = query({
  args: { key: v.string(), requestId: v.optional(v.string()), shareToken: v.optional(v.string()) },
  handler: async (ctx, { key, requestId, shareToken }) => {
    const original = originalPhotoKey(key);
    if (!original) return false;
    const id = ctx.db.normalizeId("collections", original.slice(0, original.indexOf("/")));
    if (!id) return false;
    if (requestId !== undefined) {
      const searchId = ctx.db.normalizeId("searchRequests", requestId);
      const request = searchId ? await ctx.db.get(searchId) : null;
      return Boolean(request && request.collectionId === id && request.status === "complete" &&
        request.imagesFound.includes(original) && await canReadRequest(ctx, request));
    }
    const gallery = publicView(await ctx.db.get(id), shareToken);
    if (gallery && (gallery.showAllPhotos || gallery.previewImages.includes(original))) return true;
    try {
      await requireCollectionOwner(ctx, id);
      return true;
    } catch {
      return false;
    }
  },
});

function normalizeSubdomain(value: string) {
  const subdomain = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain)) {
    throw new ConvexError("Use 3–63 lowercase letters, numbers, or hyphens");
  }
  return subdomain;
}

async function ensureSubdomainAvailable(ctx: MutationCtx, subdomain: string, exceptId?: Id<"collections">) {
  const existing = await ctx.db
    .query("collections")
    .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
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
  args: { title: v.string(), description: v.string(), subdomain: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const subdomain = args.subdomain?.trim() ? normalizeSubdomain(args.subdomain) : undefined;
    if (subdomain) await ensureSubdomainAvailable(ctx, subdomain);
    // During the trial a gallery stays online for a week; the first top-up extends it.
    const { paid } = await balanceFor(ctx, user._id);
    const expiresAt = Date.now() + (paid ? INCLUDED_DAYS : TRIAL_DAYS) * DAY;
    return ctx.db.insert("collections", {
      title: args.title.trim(),
      description: args.description.trim(),
      subdomain,
      published: false,
      sharing: "link",
      shareToken: crypto.randomUUID().replaceAll("-", ""),
      status: "not_started",
      imagesCount: 0,
      storedBytes: 0,
      expiresAt,
      storagePaidUntil: expiresAt,
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
    return collection?.sharing === "link" ? null : publicView(collection);
  },
});

export const getPublicByToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    const collection = await ctx.db.query("collections").withIndex("by_share_token", (q) => q.eq("shareToken", shareToken)).unique();
    return publicView(collection, shareToken);
  },
});

export const getPublic = query({
  args: { id: v.id("collections"), shareToken: v.optional(v.string()) },
  handler: async (ctx, { id, shareToken }) => publicView(await ctx.db.get(id), shareToken),
});

export const canManage = query({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    await requireCollectionOwner(ctx, id);
    return true;
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    subdomain: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    welcomeMessage: v.optional(v.string()),
    showAllPhotos: v.optional(v.boolean()),
    sharing: v.optional(v.union(v.literal("link"), v.literal("subdomain"))),
    crowdsource: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user, collection, canClaimLegacy } = await requireCollectionOwner(ctx, args.id);
    const subdomain = args.subdomain?.trim() ? normalizeSubdomain(args.subdomain) : undefined;
    const sharing = args.sharing ?? collection.sharing ?? "subdomain";
    const crowdsource = args.crowdsource ?? collection.crowdsource ?? false;
    if (!subdomain && sharing === "subdomain" && collection.published !== false) throw new ConvexError("A published gallery needs a page address");
    if (subdomain) await ensureSubdomainAvailable(ctx, subdomain, args.id);
    await ctx.db.patch(args.id, {
      subdomain,
      sharing,
      shareToken: collection.shareToken ?? crypto.randomUUID().replaceAll("-", ""),
      crowdsource,
      title: args.title.trim(),
      description: args.description.trim(),
      welcomeMessage: args.welcomeMessage?.trim() || undefined,
      // Closing contributions later must not unexpectedly hide photos people have already shared.
      showAllPhotos: crowdsource || (args.showAllPhotos ?? collection.showAllPhotos ?? true),
      ...(canClaimLegacy ? { createdBy: user._id } : {}),
    });
  },
});

/** Publication is independent of photo processing and page edits. */
export const setPublished = mutation({
  args: { id: v.id("collections"), published: v.boolean() },
  handler: async (ctx, { id, published }) => {
    const { collection } = await requireCollectionOwner(ctx, id);
    if (published) {
      requireActiveCollection(collection);
      if (collection.sharing !== "link" && !collection.subdomain) throw new ConvexError("Save a page address before publishing");
    }
    await ctx.db.patch(id, { published });
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
    const uploads = await ctx.db.query("uploads").withIndex("by_collection", (q) => q.eq("collectionId", id)).collect();
    const batches = (await Promise.all(uploads.map((upload) =>
      ctx.db.query("uploadBatches").withIndex("by_upload", (q) => q.eq("uploadId", upload._id)).collect()))).flat();
    // The owner deletion endpoint has removed the storage prefixes, so settle charges and holds before removing their records.
    for (const batch of batches) {
      if (batch.status === "pending" || batch.status === "running") await returnPhotosNow(ctx, batch, batch.names.length);
      else if (batch.refundPending) await returnPhotosNow(ctx, batch, batch.refundPending);
      if (batch.status === "staging" && batch.staging?.reservedBy) await releasePhotos(ctx, batch.staging.reservedBy, batch.names.length);
    }
    const sessions = await ctx.db.query("telegramSessions").withIndex("by_collection_chat", (q) => q.eq("collectionId", id)).collect();
    await Promise.all(sessions.map((session) => ctx.db.delete(session._id)));
    const jobs = await ctx.db.query("ingestJobs").withIndex("by_collection", (q) => q.eq("collectionId", id)).collect();
    await Promise.all([...searches, ...uploads, ...batches, ...jobs].map((doc) => ctx.db.delete(doc._id)));
    await ctx.db.delete(id);
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

export const storeTelegramBotToken = mutation({
  args: { id: v.id("collections"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    await requireCollectionOwner(ctx, id);
    const value = token.trim();
    await ctx.db.patch(id, { telegramBotToken: value || undefined, telegramBotUsername: undefined });
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
    const me: unknown = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
    if (!me || typeof me !== "object" || !("result" in me) || !me.result || typeof me.result !== "object" || !("username" in me.result) || typeof me.result.username !== "string") throw new Error("Invalid Telegram bot token");
    const username = me.result.username;
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
    await ctx.runMutation(internal.collections.saveBotUsername, { id, token, username });
  },
});

export const saveBotUsername = internalMutation({
  args: { id: v.id("collections"), token: v.string(), username: v.string() },
  handler: async (ctx, { id, token, username }) => {
    const collection = await ctx.db.get(id);
    if (collection?.telegramBotToken === token) await ctx.db.patch(id, { telegramBotUsername: username });
  },
});

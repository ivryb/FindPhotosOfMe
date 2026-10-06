import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { canAccessGallery, requireServiceToken } from "./authz";

const mode = v.union(v.literal("search"), v.literal("upload"));
const chatArgs = { collectionId: v.id("collections"), chatId: v.string(), serviceToken: v.string() };

export async function requireTelegramSession(ctx: QueryCtx, collectionId: Id<"collections">, chatId: string) {
  const collection = await ctx.db.get(collectionId);
  const session = await ctx.db.query("telegramSessions")
    .withIndex("by_collection_chat", (q) => q.eq("collectionId", collectionId).eq("chatId", chatId)).unique();
  if (!collection || !canAccessGallery(collection, session?.shareToken)) {
    throw new ConvexError("This gallery is private or offline. Open the invite link shared by its owner.");
  }
  if (!session) throw new ConvexError("Open the bot’s invite link and press Start first.");
  return { collection, session };
}

/** Starting with the invite authorizes this chat; ordinary messages never reveal a secret link. */
export const enter = mutation({
  args: { ...chatArgs, inviteToken: v.optional(v.string()), mode: v.optional(mode) },
  handler: async (ctx, { collectionId, chatId, serviceToken, inviteToken, mode: nextMode }) => {
    requireServiceToken(serviceToken);
    const collection = await ctx.db.get(collectionId);
    const previous = await ctx.db.query("telegramSessions")
      .withIndex("by_collection_chat", (q) => q.eq("collectionId", collectionId).eq("chatId", chatId)).unique();
    const shareToken = inviteToken || previous?.shareToken;
    if (!collection || !canAccessGallery(collection, shareToken)) {
      throw new ConvexError("This gallery is private or offline. Open the invite link shared by its owner.");
    }
    const selected = nextMode ?? previous?.mode ?? "search";
    if (nextMode === "upload" && !collection.crowdsource) throw new ConvexError("Guest uploads are turned off.");
    const values = { collectionId, chatId, shareToken, mode: selected, contributorKey: previous?.contributorKey ?? crypto.randomUUID().replaceAll("-", "") };
    if (previous) await ctx.db.patch(previous._id, values);
    else await ctx.db.insert("telegramSessions", values);
    return selected;
  },
});

export const getForService = query({
  args: chatArgs,
  handler: async (ctx, { collectionId, chatId, serviceToken }) => {
    requireServiceToken(serviceToken);
    const { session } = await requireTelegramSession(ctx, collectionId, chatId);
    return session;
  },
});

export const queueUpload = mutation({
  args: { ...chatArgs, fileId: v.string(), filename: v.string(), mediaGroupId: v.optional(v.string()) },
  handler: async (ctx, { serviceToken, mediaGroupId, ...args }) => {
    requireServiceToken(serviceToken);
    const { collection, session } = await requireTelegramSession(ctx, args.collectionId, args.chatId);
    if (!collection.crowdsource || session.mode !== "upload") throw new ConvexError("Choose Upload photos before sending gallery photos.");
    // One acknowledgement per album keeps a batch of ten photos from flooding the chat.
    const notify = !mediaGroupId || session.lastUploadGroup !== mediaGroupId;
    if (mediaGroupId) await ctx.db.patch(session._id, { lastUploadGroup: mediaGroupId });
    await ctx.scheduler.runAfter(0, internal.telegram.uploadAndReply, { ...args, notify, album: Boolean(mediaGroupId) });
  },
});

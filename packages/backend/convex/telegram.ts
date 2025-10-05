import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { mutation, action, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * HTTP endpoint to handle Telegram webhook requests
 * This will be called by Telegram servers when users interact with the bot
 */
export const webhook = httpAction(async (ctx, request) => {
  console.log("[Telegram Webhook] Received request");
  
  try {
    const update = await request.json();
    console.log("[Telegram Webhook] Update received:", JSON.stringify(update, null, 2));
    
    // Forward the update to be processed by the bot
    await ctx.runAction(internal.telegram.processUpdate, { update });
    
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Telegram Webhook] Error processing update:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Internal action to process Telegram updates
 * This gets called by the webhook handler
 */
export const processUpdate = internalAction({
  args: { update: v.any() },
  handler: async (ctx, { update }) => {
    console.log("[Telegram] Processing update:", update);
    
    // Store the update for the bot to process
    // The actual bot processing happens in the telegram app
    await ctx.runMutation(internal.telegram.storeUpdate, { update });
  },
});

/**
 * Store Telegram update for processing
 */
export const storeUpdate = internalMutation({
  args: { update: v.any() },
  handler: async (ctx, { update }) => {
    // For now, just log it. The bot will handle this via the webhook directly
    console.log("[Telegram] Update stored:", update);
  },
});

/**
 * Set webhook URL for a collection's Telegram bot
 */
export const setWebhook = action({
  args: {
    collectionId: v.id("collections"),
  },
  handler: async (ctx, { collectionId }) => {
    const collection = await ctx.runQuery(internal.telegram.getCollection, { collectionId });
    
    if (!collection || !collection.telegramBotToken) {
      throw new Error("Collection not found or bot token not set");
    }

    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("TELEGRAM_WEBHOOK_URL environment variable not set");
    }

    console.log(`[Telegram] Setting webhook for collection ${collectionId} to ${webhookUrl}`);

    // Set the webhook URL on Telegram
    const setWebhookUrl = `https://api.telegram.org/bot${collection.telegramBotToken}/setWebhook`;
    const response = await fetch(setWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${webhookUrl}/telegram/webhook/${collectionId}`,
      }),
    });

    const result = await response.json();
    console.log("[Telegram] Webhook set result:", result);

    if (!result.ok) {
      throw new Error(`Failed to set webhook: ${result.description}`);
    }

    return result;
  },
});

/**
 * Update collection's Telegram bot token
 */
export const updateBotToken = mutation({
  args: {
    collectionId: v.id("collections"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { collectionId, token }) => {
    console.log(`[Telegram] Updating bot token for collection ${collectionId}`);
    
    await ctx.db.patch(collectionId, {
      telegramBotToken: token,
    });

    // If token is set, trigger webhook setup
    if (token) {
      await ctx.scheduler.runAfter(0, internal.telegram.setWebhook, { collectionId });
    }
  },
});

/**
 * Get collection by ID (internal)
 */
export const getCollection = internalQuery({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }) => {
    return await ctx.db.get(collectionId);
  },
});

/**
 * Send notification to Telegram when search is complete
 */
export const notifySearchComplete = action({
  args: {
    searchRequestId: v.id("searchRequests"),
  },
  handler: async (ctx, { searchRequestId }) => {
    const searchRequest = await ctx.runQuery(internal.telegram.getSearchRequest, { searchRequestId });
    
    if (!searchRequest || !searchRequest.telegramChatId) {
      console.log("[Telegram] No chat ID found for search request, skipping notification");
      return;
    }

    const collection = await ctx.runQuery(internal.telegram.getCollection, {
      collectionId: searchRequest.collectionId,
    });

    if (!collection || !collection.telegramBotToken) {
      console.log("[Telegram] No bot token found for collection, skipping notification");
      return;
    }

    console.log(`[Telegram] Notifying chat ${searchRequest.telegramChatId} about search completion`);

    // The bot will handle sending the actual media group
    // This is just a placeholder to show the flow
    // The actual implementation will be in the telegram app
  },
});

/**
 * Get search request (internal)
 */
export const getSearchRequest = internalQuery({
  args: { searchRequestId: v.id("searchRequests") },
  handler: async (ctx, { searchRequestId }) => {
    return await ctx.db.get(searchRequestId);
  },
});

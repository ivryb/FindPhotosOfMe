"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Set Telegram webhook for a collection's bot token.
 * Requires env TELEGRAM_WEBHOOK_BASE_URL, e.g. https://your-vercel-app.vercel.app
 */
export const setWebhook = internalAction({
  args: { collectionId: v.id("collections") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const webhookBase = process.env.TELEGRAM_WEBHOOK_BASE_URL;
    if (!webhookBase) {
      throw new Error("TELEGRAM_WEBHOOK_BASE_URL not configured");
    }

    const collection = await ctx.runQuery(api.collections.get, {
      id: args.collectionId,
    });

    if (!collection || !collection.telegramBotToken) {
      throw new Error("Collection or Telegram token not found");
    }

    const webhookUrl = `${webhookBase}/api/telegram/${args.collectionId}`;
    const endpoint = `https://api.telegram.org/bot${collection.telegramBotToken}/setWebhook`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
    });
    const data = (await res.json()) as any;
    if (!res.ok || !data.ok) {
      throw new Error(
        `Failed to set webhook: ${res.status} ${data?.description || "unknown"}`
      );
    }
    return true;
  },
});

/**
 * Send Telegram results (media groups) when a search completes.
 * Requires env R2_PROXY_BASE_URL pointing to web proxy, e.g. https://web.app/api/r2
 */
export const sendResults = internalAction({
  args: { searchRequestId: v.id("searchRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const r2ProxyBase = process.env.R2_PROXY_BASE_URL;
    if (!r2ProxyBase) {
      throw new Error("R2_PROXY_BASE_URL not configured");
    }

    const request = await ctx.runQuery(api.searchRequests.get, {
      id: args.searchRequestId,
    });
    if (!request) return null;

    const chatId = request.telegramChatId;
    if (!chatId) return null;

    const collection = await ctx.runQuery(api.collections.get, {
      id: request.collectionId,
    });
    const token = collection?.telegramBotToken;
    if (!token) return null;

    const apiBase = `https://api.telegram.org/bot${token}`;

    // If error or no images, send a simple message
    const total = request.imagesFound?.length ?? 0;
    if (!request.imagesFound || total === 0) {
      await fetch(`${apiBase}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "No matching photos found." }),
      });
      return null;
    }

    // Chunk into groups of up to 10 images per Telegram rules
    const chunkSize = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < total; i += chunkSize) {
      chunks.push(request.imagesFound.slice(i, i + chunkSize));
    }

    for (let groupIndex = 0; groupIndex < chunks.length; groupIndex++) {
      const group = chunks[groupIndex];
      const media = group.map((path, idx) => ({
        type: "photo",
        media: `${r2ProxyBase}/${path}`,
        caption:
          idx === 0 && groupIndex === 0
            ? `Found ${total} matching photos`
            : undefined,
      }));

      const res = await fetch(`${apiBase}/sendMediaGroup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, media }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to send media group: ${res.status} ${body}`);
      }
    }

    return null;
  },
});

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
// Note: result delivery is handled inside the Telegram webhook handler.

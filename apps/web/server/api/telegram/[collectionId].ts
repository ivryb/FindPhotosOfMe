import { Bot, webhookCallback } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { toWebRequest } from "h3";
import { handleStart } from "../../utils/telegram/start";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { telegramWebhookSecret } from "@FindPhotosOfMe/backend/telegram";

export default defineEventHandler(async (event) => {
  assertMethod(event, "POST");
  const collectionId = getRouterParam(event, "collectionId");
  if (!collectionId || !/^[a-z0-9]+$/.test(collectionId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid event ID" });
  }
  const config = useRuntimeConfig(event);
  if (!config.public.convexUrl || !config.serviceToken) {
    throw createError({ statusCode: 503, statusMessage: "Telegram is not configured" });
  }
  const convex = new ConvexHttpClient(config.public.convexUrl);
  const collection = await convex.query(api.collections.getForService, {
    id: collectionId as Id<"collections">,
    serviceToken: config.serviceToken,
  });
  if (!collection?.telegramBotToken) {
    throw createError({ statusCode: 404, statusMessage: "Event bot not found" });
  }
  const secret = await telegramWebhookSecret(collection.telegramBotToken);
  if (getHeader(event, "x-telegram-bot-api-secret-token") !== secret) {
    throw createError({ statusCode: 403, statusMessage: "Invalid webhook secret" });
  }

  const bot = new Bot(collection.telegramBotToken);
  bot.command("start", handleStart(collection));
  bot.on(":photo", async (ctx) => {
    const photo = ctx.message?.photo?.at(-1);
    if (!photo) return;
    const initial = await ctx.reply("🔍 Starting search...");
    await convex.mutation(api.searchRequests.createForService, {
      collectionId: collection._id,
      telegramChatId: String(ctx.chat.id),
      fileId: photo.file_id,
      messageId: initial.message_id,
      serviceToken: config.serviceToken,
    });
  });

  // Wait only for the durable handoff; cold Python searches run in the Convex scheduler.
  return webhookCallback(bot, "cloudflare-mod", { secretToken: secret })(toWebRequest(event));
});

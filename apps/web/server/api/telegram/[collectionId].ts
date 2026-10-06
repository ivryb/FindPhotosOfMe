import { ConvexError } from "convex/values";
import { Bot, InlineKeyboard, Keyboard, webhookCallback } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { toWebRequest } from "h3";
import { welcomeText } from "../../utils/telegram/start";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { galleryUrl } from "@FindPhotosOfMe/backend/gallery";
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
  const keyboard = new Keyboard().text("Find my photos");
  if (collection.crowdsource) keyboard.text("Upload photos");
  keyboard.row().text("Browse gallery").resized();
  const chatArgs = (chatId: number) => ({ collectionId: collection._id, chatId: String(chatId), serviceToken: config.serviceToken });

  // Upload intent and invites belong to one person, never to a group chat sharing the bot.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply("Please open this bot in a private chat using your gallery invite link.");
      return;
    }
    try { await next(); } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await ctx.reply(String(error.data));
    }
  });
  bot.command("start", async (ctx) => {
    await convex.mutation(api.telegramAccess.enter, { ...chatArgs(ctx.chat.id), inviteToken: ctx.match.trim() || undefined, mode: "search" });
    await ctx.reply(welcomeText(collection), { reply_markup: keyboard, parse_mode: collection.welcomeMessage ? "MarkdownV2" : undefined });
  });
  bot.hears("Find my photos", async (ctx) => {
    await convex.mutation(api.telegramAccess.enter, { ...chatArgs(ctx.chat.id), mode: "search" });
    await ctx.reply("Send one selfie to find your photos. Your selfie will not be added to the gallery.", { reply_markup: keyboard });
  });
  bot.hears("Upload photos", async (ctx) => {
    await convex.mutation(api.telegramAccess.enter, { ...chatArgs(ctx.chat.id), mode: "upload" });
    await ctx.reply("Send photos or albums to add them to the gallery. Everyone with access will be able to see and download them. Send JPEG or PNG files to preserve their original quality. Choose Find my photos when you want to search instead.", { reply_markup: keyboard });
  });
  bot.hears("Browse gallery", async (ctx) => {
    await convex.mutation(api.telegramAccess.enter, chatArgs(ctx.chat.id));
    const link = galleryUrl(collection, config.public.origin || getRequestURL(event).origin);
    await ctx.reply("Browse and download the gallery’s photos.", { reply_markup: new InlineKeyboard().url("Open gallery", link) });
  });
  bot.on([":photo", ":document"], async (ctx) => {
    await convex.mutation(api.telegramAccess.enter, chatArgs(ctx.chat.id));
    const session = await convex.query(api.telegramAccess.getForService, chatArgs(ctx.chat.id));
    const photo = ctx.message?.photo?.at(-1);
    const document = ctx.message?.document;
    const file = photo ?? document;
    if (!file) return;
    if (session.mode === "upload") {
      if (document && !["image/jpeg", "image/png"].includes(document.mime_type ?? "")) {
        await ctx.reply("Send JPEG or PNG photos. You can also upload photos or ZIPs on the gallery page.");
        return;
      }
      if ((file.file_size ?? 0) > 20 * 1024 * 1024) {
        await ctx.reply("Use the gallery’s web uploader for photos over 20 MB. Choose Browse gallery to open it.");
        return;
      }
      await convex.mutation(api.telegramAccess.queueUpload, {
        ...chatArgs(ctx.chat.id), fileId: file.file_id,
        filename: `Telegram-${ctx.message!.message_id}.${document?.mime_type === "image/png" ? "png" : "jpg"}`,
        mediaGroupId: ctx.message?.media_group_id,
      });
      return;
    }
    if (!photo) {
      await ctx.reply("Send your selfie as a photo, or choose Upload photos to contribute image files.");
      return;
    }
    const initial = await ctx.reply("🔍 Starting search...");
    try {
      await convex.mutation(api.searchRequests.createForService, {
        collectionId: collection._id, telegramChatId: String(ctx.chat.id), fileId: photo.file_id,
        messageId: initial.message_id, serviceToken: config.serviceToken,
      });
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await ctx.api.editMessageText(ctx.chat.id, initial.message_id, String(error.data));
    }
  });

  // Wait only for the durable handoff; cold Python searches run in the Convex scheduler.
  return webhookCallback(bot, "cloudflare-mod", { secretToken: secret })(toWebRequest(event));
});

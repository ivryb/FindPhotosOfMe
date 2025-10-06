import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { handleStart } from "./_handlers/start";
import { createOnPhotoHandler } from "./_handlers/onPhoto";
import { log } from "./_utils/log";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const collectionId = getRouterParam(event, "collectionId");

  if (!collectionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing collectionId",
    });
  }

  const convexUrl = config.public.convexUrl;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required");
  }

  const httpClient = new ConvexHttpClient(convexUrl as string);

  const collection = await httpClient.query("collections:get" as any, {
    id: collectionId,
  });

  if (!collection || !collection.telegramBotToken) {
    throw createError({
      statusCode: 404,
      statusMessage: "Collection/token not found",
    });
  }

  const bot = new Bot(collection.telegramBotToken);

  bot.command("start", handleStart);

  bot.on(
    ":photo",
    createOnPhotoHandler(
      convexUrl as string,
      collectionId,
      collection.telegramBotToken
    )
  );

  bot.catch((err: any) => {
    const ctx = err.ctx;
    log(`Bot error while handling update ${ctx.update.update_id}`);
    const e = err.error;
    if (e instanceof GrammyError) {
      log("Error in request", { description: e.description });
    } else if (e instanceof HttpError) {
      log("Could not contact Telegram", { error: String(e) });
    } else {
      log("Unknown error", { error: String(e) });
    }
  });

  return webhookCallback(bot, "https")(event.node.req, event.node.res);
});

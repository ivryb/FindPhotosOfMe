import { Bot, webhookCallback } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { handleStart } from "./_handlers/start";
import { createOnPhotoHandler } from "./_handlers/onPhoto";
import { log } from "./_utils/log";

export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, "collectionId") as string;
  const config = useRuntimeConfig();
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

  bot.command("start", handleStart(collection));

  bot.on(":photo", createOnPhotoHandler(botToken, collection));

  bot.catch((err: any) => {
    log(`Bot error while handling update ${err}`);
  });

  const callback = webhookCallback(bot, "http");

  await callback(event.node.req, event.node.res);

  return event.node.res;
});

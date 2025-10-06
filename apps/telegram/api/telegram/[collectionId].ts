import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import { handleStart } from "./handlers/start";
import { createOnPhotoHandler } from "./handlers/onPhoto";
import { log } from "./utils/log";

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL is required");
}

const client = new ConvexHttpClient(convexUrl);

export default async function handler(req: any, res: any) {
  const collectionId = req.query.collectionId as string;
  if (!collectionId) {
    res.status(400).json({ ok: false, error: "Missing collectionId" });
    return;
  }

  // Fetch token from Convex per collection
  const collection = await client.query(api.collections.get, {
    id: collectionId as Id<"collections">,
  });
  if (!collection || !collection.telegramBotToken) {
    res.status(404).json({ ok: false, error: "Collection/token not found" });
    return;
  }

  const bot = new Bot(collection.telegramBotToken);

  // /start handler
  bot.command("start", handleStart);

  // Photo handler
  bot.on(
    ":photo",
    createOnPhotoHandler(
      convexUrl as string,
      collectionId as Id<"collections">,
      collection.telegramBotToken
    )
  );

  // Errors
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

  const vercelHandler = (webhookCallback as any)(bot, "vercel");
  return vercelHandler(req, res);
}

import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NUXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL or NUXT_PUBLIC_CONVEX_URL is required");
}

const client = new ConvexHttpClient(convexUrl);

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hi! Send me a clear photo of yourself to search this collection."
    );
  });

  // Photo handler
  bot.on(":photo", async (ctx) => {
    const photos = ctx.message.photo;
    if (!Array.isArray(photos) || photos.length === 0) return;

    const best = photos[photos.length - 1];
    const fileId = best.file_id;

    // Acknowledge start
    await ctx.reply("Search started. I'll send results here when finished.");

    // Create search request with telegramChatId
    const requestId = await client.mutation(api.searchRequests.create, {
      collectionId: collectionId as Id<"collections">,
      telegramChatId: String(ctx.chat?.id),
    });

    // Download photo file link
    const token = collection.telegramBotToken;
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    );
    const fileData = await fileRes.json();
    if (!fileData.ok) {
      await ctx.reply("Failed to download the photo. Try again.");
      return;
    }
    const path = fileData.result.file_path as string;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${path}`;

    // Send to Python search API
    const apiUrl = process.env.NUXT_PUBLIC_API_URL;
    if (!apiUrl) {
      await ctx.reply("Search service not configured.");
      return;
    }

    const form = new FormData();
    form.append("search_request_id", requestId as any);
    const imgRes = await fetch(fileUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    form.append("reference_photo", new Blob([buf]), "photo.jpg");

    try {
      const resp = await fetch(`${apiUrl}/api/search-photos`, {
        method: "POST",
        body: form as any,
      });
      if (!resp.ok) {
        const text = await resp.text();
        await ctx.reply(`Failed to start search: ${text}`);
      }
    } catch (e) {
      await ctx.reply("Search service unreachable.");
    }
  });

  // Errors
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Bot error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
  });

  return webhookCallback(bot, "vercel")(req, res);
}

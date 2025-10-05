import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import { FormData, Blob } from "undici";

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
        return;
      }
    } catch (e) {
      await ctx.reply("Search service unreachable.");
      return;
    }

    // Poll Convex for result and send from here
    const timeoutMs = Number(process.env.TELEGRAM_SEARCH_TIMEOUT_MS || 60000);
    const intervalMs = Number(process.env.TELEGRAM_POLL_INTERVAL_MS || 1500);
    const r2ProxyBase = process.env.R2_PROXY_BASE_URL;

    const start = Date.now();
    const deadline = start + timeoutMs;

    const log = (msg: string, extra?: Record<string, unknown>) =>
      console.log(
        `[${new Date().toISOString()}] [bot] ${msg}`,
        extra ? JSON.stringify(extra) : ""
      );

    log("Polling for search result", { requestId });

    let latest: any = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        latest = await client.query(api.searchRequests.get, {
          id: requestId as Id<"searchRequests">,
        });
      } catch (e) {
        log("Convex query error", { error: String(e) });
      }

      if (!latest) {
        // Rare: not yet visible due to eventual consistency; wait
        if (Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }

      if (latest.status === "complete") break;
      if (latest.status === "error") break;

      if (Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    if (!latest) {
      await ctx.reply("Timed out waiting for result. Please try again.");
      return;
    }

    if (latest.status === "error") {
      await ctx.reply("Search failed. Please try again later.");
      return;
    }

    const images: string[] = Array.isArray(latest.imagesFound)
      ? latest.imagesFound
      : [];

    if (!images.length) {
      await ctx.reply("No matching photos found.");
      return;
    }

    if (!r2ProxyBase) {
      await ctx.reply(
        "Found results, but image proxy is not configured (R2_PROXY_BASE_URL)."
      );
      return;
    }

    // Chunk into groups of up to 10 images per Telegram rules
    const chunkSize = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < images.length; i += chunkSize) {
      chunks.push(images.slice(i, i + chunkSize));
    }

    for (let groupIndex = 0; groupIndex < chunks.length; groupIndex++) {
      const group = chunks[groupIndex];
      const media = group.map((path, idx) => ({
        type: "photo",
        media: `${r2ProxyBase}/${path}`,
        caption:
          idx === 0 && groupIndex === 0
            ? `Found ${images.length} matching photos`
            : undefined,
      }));

      try {
        await ctx.api.sendMediaGroup(ctx.chat.id, media as any);
      } catch (e) {
        log("Failed to send media group", { error: String(e) });
        await ctx.reply("Failed to send some results.");
        break;
      }
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

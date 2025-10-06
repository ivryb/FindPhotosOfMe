import type { Context } from "grammy";
// Use string references to avoid requiring convex codegen imports at runtime
import { ConvexHttpClient } from "convex/browser";
import { getPhotoFileUrl } from "../../../../../telegram/src/utils/telegram.js";
import { log } from "../../../../../telegram/src/utils/log.js";
import { waitForSearch } from "../../../../../telegram/src/utils/waitForSearch.js";
import { sendPhotoResults } from "../../../../../telegram/src/utils/results.js";

export const createOnPhotoHandler = (
  convexUrl: string,
  collectionId: string,
  botToken: string
) => {
  const httpClient = new ConvexHttpClient(convexUrl);

  return async (ctx: Context) => {
    const photos = ctx.message?.photo;
    if (!Array.isArray(photos) || photos.length === 0) return;

    const best = photos[photos.length - 1];
    const fileId = best.file_id;

    await ctx.reply("Search started. I'll send results here when finished.");

    const requestId = await httpClient.mutation(
      "searchRequests:create" as any,
      {
        collectionId,
        telegramChatId: String(ctx.chat?.id),
      }
    );

    const fileUrl = await getPhotoFileUrl(botToken, fileId);
    if (!fileUrl) {
      await ctx.reply("Failed to download the photo. Try again.");
      return;
    }

    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      await ctx.reply("Search service not configured.");
      return;
    }

    const imgRes = await fetch(fileUrl);
    if (!imgRes.ok) {
      await ctx.reply("Failed to download the photo. Try again.");
      return;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const form = new FormData();
    form.append("search_request_id", String(requestId));
    const blob = new Blob([buf], { type: "image/jpeg" });
    form.append("reference_photo", blob, "photo.jpg");

    try {
      const resp = await fetch(`${apiUrl}/api/search-photos`, {
        method: "POST",
        body: form,
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

    const timeoutMs = Number(process.env.TELEGRAM_SEARCH_TIMEOUT_MS || 60000);
    const r2ProxyBase = process.env.R2_PROXY_BASE_URL;
    if (!r2ProxyBase) {
      await ctx.reply(
        "Found results, but image proxy is not configured (R2_PROXY_BASE_URL)."
      );
      return;
    }

    log("Subscribing for search result", { requestId: String(requestId) });
    const latest = await waitForSearch(convexUrl, requestId as any, timeoutMs);

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

    await sendPhotoResults(ctx, images, r2ProxyBase);
  };
};

import type { Context } from "grammy";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import type { TelegramInputMediaPhoto } from "../_utils/getPhotoFileUrl";
import { waitUntil } from "@vercel/functions";
import { ConvexHttpClient } from "convex/browser";
import { getPhotoFileUrl } from "../_utils/getPhotoFileUrl";
import { log } from "../_utils/log";
import { waitForSearch } from "../_utils/waitForSearch";
import { useR2 } from "../../../utils/r2";

export const createOnPhotoHandler = (
  botToken: string,
  collection: Doc<"collections">
) => {
  const config = useRuntimeConfig();
  const httpClient = new ConvexHttpClient(config.public.convexUrl);

  return async (ctx: Context) => {
    const photos = ctx.message?.photo;

    if (!Array.isArray(photos) || photos.length === 0) return;

    const initial = await ctx.reply("Starting search...");

    waitUntil(continueSearch(ctx, initial.message_id));
  };

  async function continueSearch(ctx: Context, statusMessageId: number) {
    const photos = ctx.message?.photo;

    const best = photos?.[photos.length - 1];
    const fileId = best?.file_id;

    if (!fileId) return;

    const apiUrl = config.public.apiURL;

    if (!apiUrl) {
      await ctx.reply("Oops, search service not configured 😮");
      return;
    }

    const requestId = await httpClient.mutation(
      "searchRequests:create" as any,
      {
        collectionId: collection._id,
        telegramChatId: String(ctx.chat?.id),
      }
    );

    const fileUrl = await getPhotoFileUrl(botToken, fileId);

    if (!fileUrl) {
      await ctx.reply("Failed to download the photo, please try again 😣");
      return;
    }

    const imgRes = await fetch(fileUrl);

    if (!imgRes.ok) {
      await ctx.reply("Failed to download the photo, please try again 😣");
      return;
    }

    try {
      await sendPhotoToAPI(imgRes, apiUrl, requestId);
    } catch (e) {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessageId,
          `Search service unreachable. Please try again later.`
        );
      } catch {}

      return;
    }

    const timeoutMs = Number(process.env.TELEGRAM_SEARCH_TIMEOUT_MS || 60000);

    log("Subscribing for search result", {
      requestId: String(requestId),
    });

    const chatId = ctx.chat?.id;
    let lastEditAt = 0;
    let lastText: string | null = null;

    const searchRequest = await waitForSearch(
      requestId as any,
      timeoutMs,
      async (doc) => {
        if (!chatId) return;
        if (doc.status !== "processing") return;

        const total = doc.totalImages ?? undefined;
        const processed = doc.processedImages ?? 0;
        const pct = total && total > 0 ? Math.floor((processed / total) * 100) : undefined;
        const text = total
          ? `Scanned ${processed} of ${total} photos${pct !== undefined ? ` (${pct}%)` : ""}...`
          : `Scanned ${processed} photos...`;

        const now = Date.now();
        // Throttle: at most once every 1.5s and only when text changes
        if (text === lastText || now - lastEditAt < 1500) return;
        lastText = text;
        lastEditAt = now;
        try {
          await ctx.api.editMessageText(chatId, statusMessageId, text);
        } catch (e) {
          // Ignore edit errors (e.g., message not modified)
        }
      }
    );

    if (!searchRequest) {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessageId,
          "Timed out waiting for result. Please try again."
        );
      } catch {}
      return;
    }

    if (searchRequest.status === "error") {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessageId,
          "Search failed, please try again later."
        );
      } catch {}
      return;
    }

    const imagePaths: string[] = Array.isArray(searchRequest.imagesFound)
      ? searchRequest.imagesFound
      : [];

    if (!imagePaths.length) {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessageId,
          "No matching photos found."
        );
      } catch {}

      return;
    }

    const imageUrls = await generateSignedUrls(imagePaths);

    if (!imageUrls.length) {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          statusMessageId,
          "Couldn't access photos from cloud storage."
        );
      } catch {}

      return;
    }

    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        statusMessageId,
        `Found ${imageUrls.length} matching photo(s). Sending results...`
      );
    } catch {}

    await sendPhotoResults(ctx, imageUrls);
  }
};

async function generateSignedUrls(imagePaths: string[]) {
  log("Generating signed URLs", { imageCount: imagePaths.length });

  const r2 = useR2();
  const imageUrls: string[] = [];
  for (const path of imagePaths) {
    const signedUrl = await r2.getSignedUrl(path, 3600);
    imageUrls.push(signedUrl);
  }
  return imageUrls;
}

async function sendPhotoToAPI(
  imgRes: Response,
  apiUrl: string,
  requestId: string
) {
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const form = new FormData();
  form.append("search_request_id", String(requestId));
  const blob = new Blob([buf], { type: "image/jpeg" });
  form.append("reference_photo", blob, "photo.jpg");

  const resp = await fetch(`${apiUrl}/api/search-photos`, {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text();

    log("Failed to start search", {
      requestId,
      error: text,
    });

    throw new Error(text);
  }
}

async function sendPhotoResults(ctx: Context, imageUrls: string[]) {
  const chatId = ctx.chat?.id;

  if (!chatId) {
    log("No chat ID found", { imageCount: imageUrls.length });
    return;
  }

  log("Sending photo results", {
    imageCount: imageUrls.length,
    firstUrl: imageUrls[0],
  });

  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < imageUrls.length; i += chunkSize) {
    chunks.push(imageUrls.slice(i, i + chunkSize));
  }

  for (let groupIndex = 0; groupIndex < chunks.length; groupIndex++) {
    const group = chunks[groupIndex];
    const media: TelegramInputMediaPhoto[] = group.map((url, idx) => ({
      type: "photo",
      media: url,
      caption:
        idx === 0 && groupIndex === 0
          ? `Found ${imageUrls.length} matching photo(s)`
          : undefined,
    }));

    try {
      await ctx.api.sendMediaGroup(chatId, media);
      log("Successfully sent media group", {
        groupIndex,
        photoCount: group.length,
      });
    } catch (e) {
      log("Failed to send media group", {
        error: String(e),
        groupIndex,
        firstUrl: media[0]?.media,
      });
      await ctx.reply("Failed to send some results.");
      break;
    }
  }
}

import type { Context } from "grammy";
import { getConvexClient } from "../../../utils/convex";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { waitUntil } from "@vercel/functions";
import { getPhotoFileUrl } from "../_utils/getPhotoFileUrl";
import { log } from "../_utils/log";

export const createOnPhotoHandler = (
  botToken: string,
  collection: Doc<"collections">
) => {
  const config = useRuntimeConfig();
  const convexClient = getConvexClient();
  const apiUrl = config.public.apiURL;

  return async (ctx: Context) => {
    const photos = ctx.message?.photo;

    if (!Array.isArray(photos) || photos.length === 0) return;

    if (!apiUrl) {
      await ctx.reply("Oops, search service not configured 😮");
      return;
    }

    const initial = await ctx.reply("🔍 Starting search...");

    const updateStatusMessage = async (text: string, options: any = {}) => {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          initial.message_id,
          text,
          options
        );
      } catch (error) {
        log("Failed to edit message text", {
          text,
          ctx,
          error,
        });
      }
    };

    waitUntil(continueSearch(ctx, updateStatusMessage));
  };

  async function continueSearch(
    ctx: Context,
    updateStatusMessage: (text: string, options?: any) => Promise<void>
  ) {
    const photos = ctx.message?.photo;
    const chatId = ctx.chat?.id;

    const best = photos?.[photos.length - 1];
    const fileId = best?.file_id;

    if (!chatId) return;

    if (!fileId) return;

    const requestId = await convexClient.mutation(api.searchRequests.create, {
      collectionId: collection._id,
      telegramChatId: String(ctx.chat?.id),
    });

    const fileUrl = await getPhotoFileUrl(botToken, fileId);

    if (!fileUrl) {
      return await updateStatusMessage(
        "Failed to download the photo, please try again 😣"
      );
    }

    const imgRes = await fetch(fileUrl);

    if (!imgRes.ok) {
      return await updateStatusMessage(
        "Failed to download the photo, please try again 😣"
      );
    }

    try {
      await sendPhotoToAPI(imgRes, apiUrl, requestId);
    } catch (e) {
      return await updateStatusMessage(
        `Oops, looks like search service is unreachable 😱\nPlease try again later.`
      );
    }

    log("Subscribing for search result", {
      requestId: String(requestId),
    });

    await new Promise((resolve: any) => {
      const unsubscribe = convexClient.onUpdate(
        api.searchRequests.get,
        { id: requestId },
        async (searchRequest) => {
          if (!searchRequest) {
            await updateStatusMessage(
              "Oops, looks like search service is unreachable 😱\nPlease try again later."
            );

            unsubscribe();

            return resolve();
          }

          if (searchRequest.status == "processing") {
            const totalImages = collection.imagesCount;
            const processedImages = searchRequest.processedImages ?? 0;

            if (processedImages > 0) {
              await updateStatusMessage(
                `🔍 Scanned ${processedImages} of ${totalImages} photos...`
              );

              return resolve();
            }
          }

          if (searchRequest.status == "complete") {
            unsubscribe();

            await handleSearchComplete(ctx, searchRequest, updateStatusMessage);

            return resolve();
          }

          if (searchRequest.status == "error") {
            unsubscribe();

            log("Search request error!", {
              requestId: String(requestId),
            });

            await updateStatusMessage(
              "Oops, looks like there was an error during the search 😱\nPlease try again later."
            );

            return resolve();
          }
        }
      );
    });
  }
};

async function handleSearchComplete(
  ctx: Context,
  searchRequest: Doc<"searchRequests">,
  updateStatusMessage: (text: string, options?: any) => Promise<void>
) {
  const imagePaths: string[] = Array.isArray(searchRequest.imagesFound)
    ? searchRequest.imagesFound
    : [];

  if (!imagePaths.length) {
    return await updateStatusMessage("No matching photos were found 😔");
  }

  const imageUrls = generateProxyUrls(imagePaths);

  await updateStatusMessage(
    `Found *${imageUrls.length}* matching photo(s) 🥳`,
    {
      parse_mode: "Markdown",
    }
  );

  await sendGroupedPhotoResults(ctx, imageUrls);
}

function generateProxyUrls(imagePaths: string[]) {
  log("Generating proxy URLs", { imageCount: imagePaths.length });

  const config = useRuntimeConfig();

  const origin = config.public.origin.replace(
    "//findphotosofme.com",
    "//cdn.findphotosofme.com"
  );

  return imagePaths.map((path) => {
    const encodedPath = path
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");

    return `${origin}/api/r2/${encodedPath}`;
  });
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

  fetch(`${apiUrl}/api/search-photos`, {
    method: "POST",
    body: form,
  });
}

type TelegramInputMediaPhoto = {
  type: "photo";
  media: string;
  caption?: string;
};

async function sendGroupedPhotoResults(ctx: Context, imageUrls: string[]) {
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
    }));

    try {
      await ctx.api.sendMediaGroup(chatId, media);
      log("Successfully sent media group", {
        groupIndex,
        photoCount: group.length,
      });
    } catch (e: any) {
      log("Failed to send media group", {
        error: String(e?.message || e),
        errorCode: (e && (e.error_code || e.code)) || undefined,
        description: e?.description,
        parameters: e?.parameters,
        groupIndex,
        images: group,
      });
      // Fallback: try sending each photo individually
      for (const url of group) {
        try {
          await ctx.api.sendPhoto(chatId, url);
        } catch (e2: any) {
          log("Failed to send individual photo", {
            url,
            error: String(e2?.message || e2),
            errorCode: (e2 && (e2.error_code || e2.code)) || undefined,
            description: e2?.description,
            parameters: e2?.parameters,
          });
          await ctx.reply(
            `Telegram didn't accept a photo 😮\nTry opening the direct link: ${url}`
          );
        }
      }
    }
  }
}

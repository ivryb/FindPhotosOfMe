import type { Context } from "grammy";
import { getConvexClient } from "../../../utils/convex";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { waitUntil } from "@vercel/functions";
import { getPhotoFileUrl } from "../_utils/getPhotoFileUrl";
import { log } from "../_utils/log";
import { useR2 } from "../../../utils/r2";

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

  const imageUrls = await generateProxyUrls(imagePaths);

  if (!imageUrls.length) {
    return await updateStatusMessage(
      "Couldn't access photos from cloud storage 😔\nPlease try again later."
    );
  }

  await updateStatusMessage(
    `Found *${imageUrls.length}* matching photo(s) 🥳`,
    {
      parse_mode: "Markdown",
    }
  );

  await sendGroupedPhotoResults(ctx, imageUrls);
}

async function generateProxyUrls(imagePaths: string[]) {
  log("Generating direct R2 signed URLs", { imageCount: imagePaths.length });

  const r2 = useR2();

  const urls = await Promise.all(
    imagePaths.map(async (objectKey) => {
      const filename = objectKey.split("/").pop() ?? "photo.jpg";
      try {
        const url = await r2.getSignedUrlWithResponse(objectKey, {
          filename,
          contentType: "image/jpeg",
          expiresIn: 300,
          contentDisposition: "inline",
          cacheSeconds: 60,
        });
        return url;
      } catch (e: any) {
        log("Failed to sign R2 URL", {
          objectKey,
          error: String(e?.message || e),
        });
        return null;
      }
    })
  );

  return urls.filter(Boolean) as string[];
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
      await ctx.reply(
        "Failed to send some results 😔\nPlease try again later."
      );
      break;
    }
  }
}

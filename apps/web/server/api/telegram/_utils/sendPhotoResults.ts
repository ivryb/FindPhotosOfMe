import type { Context } from "grammy";
import { log } from "./log";
import type { TelegramInputMediaPhoto } from "./getPhotoFileUrl";

export const sendPhotoResults = async (ctx: Context, imageUrls: string[]) => {
  if (!imageUrls.length) {
    await ctx.reply("No matching photos found.");
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply("Cannot determine chat context.");
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
          ? `Found ${imageUrls.length} matching photos`
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
};

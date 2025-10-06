import type { Context } from "grammy";
import { log } from "./log";
import type { TelegramInputMediaPhoto } from "./getPhotoFileUrl";

export const sendPhotoResults = async (
  ctx: Context,
  imagePaths: string[],
  photoOrigin: string
) => {
  if (!imagePaths.length) {
    await ctx.reply("No matching photos found.");
    return;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply("Cannot determine chat context.");
    return;
  }

  const chunkSize = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < imagePaths.length; i += chunkSize) {
    chunks.push(imagePaths.slice(i, i + chunkSize));
  }

  for (let groupIndex = 0; groupIndex < chunks.length; groupIndex++) {
    const group = chunks[groupIndex];
    const media: TelegramInputMediaPhoto[] = group.map((path, idx) => ({
      type: "photo",
      media: `${photoOrigin}/${path}`,
      caption:
        idx === 0 && groupIndex === 0
          ? `Found ${imagePaths.length} matching photos`
          : undefined,
    }));

    try {
      await ctx.api.sendMediaGroup(chatId, media);
    } catch (e) {
      log("Failed to send media group", { error: String(e) });
      await ctx.reply("Failed to send some results.");
      break;
    }
  }
};

import { Context, InputMediaBuilder } from "grammy";
import { BotContext } from "../types.js";
import { config } from "../config.js";

const MAX_MEDIA_GROUP_SIZE = 10;

/**
 * Send search results as media groups
 * Telegram allows max 10 media items per group
 */
export async function sendMediaGroup(
  ctx: Context & BotContext,
  imageKeys: string[],
  subdomain: string
) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  console.log(`[Bot] Sending ${imageKeys.length} images to chat ${chatId}`);

  // Base URL for R2 images
  // In production, this would be your R2 public URL or proxy
  const baseUrl = `${config.webhookUrl}/api/r2/${subdomain}`;

  // Split images into groups of 10
  for (let i = 0; i < imageKeys.length; i += MAX_MEDIA_GROUP_SIZE) {
    const batch = imageKeys.slice(i, i + MAX_MEDIA_GROUP_SIZE);
    console.log(`[Bot] Sending batch ${i / MAX_MEDIA_GROUP_SIZE + 1}, ${batch.length} images`);

    try {
      const mediaGroup = batch.map((key, index) => {
        const imageUrl = `${baseUrl}/${key}`;
        return InputMediaBuilder.photo(imageUrl, {
          caption: index === 0 && i === 0 ? `Found you in ${batch.length} photo(s)!` : undefined,
        });
      });

      await ctx.replyWithMediaGroup(mediaGroup);
      
      // Small delay between batches to avoid rate limits
      if (i + MAX_MEDIA_GROUP_SIZE < imageKeys.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`[Bot] Error sending media group batch ${i / MAX_MEDIA_GROUP_SIZE + 1}:`, error);
      await ctx.reply(`❌ Failed to send some photos. Please try again or contact support.`);
    }
  }

  console.log(`[Bot] All images sent to chat ${chatId}`);
}

import { Context } from "grammy";
import { BotContext } from "../types.js";
import { createSearchRequest, watchSearchRequest } from "../convex-client.js";
import { sendMediaGroup } from "./results.js";
import { config } from "../config.js";

export async function handlePhoto(ctx: Context & BotContext) {
  const chatId = ctx.chat?.id;
  const photo = ctx.message?.photo;

  if (!chatId || !photo) {
    console.error("[Bot] No chat ID or photo in message");
    return;
  }

  console.log(`[Bot] Photo received from chat ${chatId}`);

  if (!ctx.collectionId) {
    await ctx.reply("❌ Bot is not configured properly. Please contact the administrator.");
    console.error("[Bot] No collection ID set for this bot instance");
    return;
  }

  try {
    // Get the highest resolution photo
    const bestPhoto = photo[photo.length - 1];
    const fileId = bestPhoto.file_id;

    console.log(`[Bot] Processing photo: ${fileId}`);

    // Send initial message
    const statusMessage = await ctx.reply(
      "🔍 **Search started!**\n\nI'm analyzing your photo and searching through the collection. This may take a few moments..."
    );

    // Create search request in Convex
    const searchRequest = await createSearchRequest(
      ctx.collectionId as any,
      chatId.toString()
    );

    console.log(`[Bot] Search request created: ${searchRequest}`);

    // Download the photo
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.me.username}/${file.file_path}`;

    console.log(`[Bot] Photo URL: ${fileUrl}`);

    // TODO: Send photo to Python service for processing
    // For now, we'll simulate the search
    // In production, you would call your Python API here:
    // const apiUrl = config.apiUrl || "http://localhost:8000";
    // await fetch(`${apiUrl}/search`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     searchRequestId: searchRequest,
    //     photoUrl: fileUrl,
    //   }),
    // });

    // Watch for search completion
    const unsubscribe = watchSearchRequest(searchRequest as any, async (data) => {
      console.log(`[Bot] Search request update:`, data);

      if (data?.status === "complete") {
        console.log(`[Bot] Search complete, found ${data.imagesFound?.length || 0} images`);
        unsubscribe();

        if (data.imagesFound && data.imagesFound.length > 0) {
          await ctx.api.editMessageText(
            chatId,
            statusMessage.message_id,
            `✅ **Search complete!**\n\nFound ${data.imagesFound.length} photo(s) with you in them!`
          );

          // Send results as media groups
          await sendMediaGroup(ctx, data.imagesFound, ctx.collectionSubdomain || "");
        } else {
          await ctx.api.editMessageText(
            chatId,
            statusMessage.message_id,
            "😔 **Search complete**\n\nUnfortunately, I couldn't find any photos of you in this collection. Try with a different photo!"
          );
        }
      } else if (data?.status === "error") {
        console.error(`[Bot] Search failed for request ${searchRequest}`);
        unsubscribe();

        await ctx.api.editMessageText(
          chatId,
          statusMessage.message_id,
          "❌ **Search failed**\n\nSomething went wrong. Please try again or contact support."
        );
      }
    });
  } catch (error) {
    console.error("[Bot] Error handling photo:", error);
    await ctx.reply(
      "❌ **Error**\n\nSomething went wrong while processing your photo. Please try again."
    );
  }
}

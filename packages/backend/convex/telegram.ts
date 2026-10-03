"use node";

import { Api } from "grammy";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const searchAndReply = internalAction({
  args: { requestId: v.id("searchRequests"), fileId: v.string(), messageId: v.number() },
  handler: async (ctx, { requestId, fileId, messageId }) => {
    const serviceToken = process.env.SERVICE_TOKEN;
    if (!serviceToken) throw new Error("SERVICE_TOKEN is not configured");
    const request = await ctx.runQuery(api.searchRequests.getForService, { id: requestId, serviceToken });
    if (!request?.telegramChatId) return;
    const collection = await ctx.runQuery(internal.collections.getInternal, { id: request.collectionId });
    if (!collection?.telegramBotToken) return;
    const telegram = new Api(collection.telegramBotToken);
    const chatId = request.telegramChatId;
    const editStatus = (text: string) => telegram.editMessageText(chatId, messageId, text);

    try {
      const apiUrl = process.env.PYTHON_API_URL;
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucket = process.env.R2_BUCKET_NAME;
      if (!apiUrl || !accountId || !accessKeyId || !secretAccessKey || !bucket) {
        throw new Error("Telegram search is not configured");
      }
      const file = await telegram.getFile(fileId);
      if (!file.file_path) throw new Error("Telegram photo is unavailable");
      const photo = await fetch(`https://api.telegram.org/file/bot${collection.telegramBotToken}/${file.file_path}`);
      if (!photo.ok) throw new Error("Telegram photo download failed");
      const body = new FormData();
      body.append("search_request_id", requestId);
      // Telegram serves its JPEG photos as application/octet-stream; the search API validates the image MIME type.
      body.append("reference_photo", new Blob([await photo.arrayBuffer()], { type: "image/jpeg" }), "photo.jpg");
      // Leave time within Convex's action limit to report a cold or stalled search.
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/search-photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceToken}` },
        body,
        signal: AbortSignal.timeout(8 * 60 * 1000),
      });
      if (!response.ok) throw new Error(`Search service returned ${response.status}`);
      const result = await ctx.runQuery(api.searchRequests.getForService, { id: requestId, serviceToken });
      if (result?.status !== "complete") throw new Error("Search did not complete");
      if (!result.imagesFound.length) {
        await editStatus("No matching photos were found 😔");
        return;
      }
      const r2 = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      const urls = await Promise.all(result.imagesFound.map((key) =>
        getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 })
      ));
      for (let offset = 0; offset < urls.length; offset += 10) {
        const group = urls.slice(offset, offset + 10);
        const [single] = group;
        if (group.length === 1 && single) {
          await telegram.sendPhoto(chatId, single);
        } else {
          await telegram.sendMediaGroup(chatId, group.map((media) => ({ type: "photo", media })));
        }
      }
      await editStatus(`Found ${urls.length} matching photo(s) 🥳`);
    } catch {
      // Do not log Telegram errors: they can contain bot tokens or private signed photo URLs.
      console.error("Telegram search or delivery failed", { requestId });
      const result = await ctx.runQuery(api.searchRequests.getForService, { id: requestId, serviceToken });
      if (result && result.status !== "complete") {
        await ctx.runMutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "error" });
      }
      await editStatus("Search or photo delivery failed 😔 Please send your photo again to retry.");
    }
  },
});

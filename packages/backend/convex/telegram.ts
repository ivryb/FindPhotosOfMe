"use node";

import { Api } from "grammy";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConvexError, v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { photoType, resizedKey, stagingKey } from "./photoKeys";

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
      await ctx.runQuery(api.telegramAccess.getForService, { collectionId: collection._id, chatId, serviceToken });
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
      await ctx.runQuery(api.telegramAccess.getForService, { collectionId: collection._id, chatId, serviceToken });
      // Telegram fetches photos of at most 5 MB from a link and many camera originals are larger, which failed whole
      // albums, so it gets each photo's screen version. Photos the screen backfill hasn't reached go as originals.
      const urls = await Promise.all(result.imagesFound.map(async (key) => {
        const screen = resizedKey(key, "screen");
        const stored = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: screen })).then(() => true, () => false);
        return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: stored ? screen : key }), { expiresIn: 900 });
      }));
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
      const result = await ctx.runQuery(api.searchRequests.getForService, { id: requestId, serviceToken });
      if (result?.error === "no_face") {
        await editStatus("No face found in this photo 🤔 Send a photo where your face is clear.");
        return;
      }
      // Do not log Telegram errors: they can contain bot tokens or private signed photo URLs.
      console.error("Telegram search or delivery failed", { requestId });
      if (result && result.status !== "complete") {
        await ctx.runMutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "error" });
      }
      await editStatus("Search or photo delivery failed 😔 Please send your photo again to retry.");
    }
  },
});

/** Telegram albums arrive as individual photo messages; each enters the same ingestion queue as web uploads. */
export const uploadAndReply = internalAction({
  args: { collectionId: v.id("collections"), chatId: v.string(), fileId: v.string(), filename: v.string(), notify: v.boolean(), album: v.boolean() },
  handler: async (ctx, { collectionId, chatId, fileId, filename, notify, album }) => {
    const serviceToken = process.env.SERVICE_TOKEN;
    if (!serviceToken) throw new Error("SERVICE_TOKEN is not configured");
    const collection = await ctx.runQuery(internal.collections.getInternal, { id: collectionId });
    if (!collection?.telegramBotToken) return;
    const telegram = new Api(collection.telegramBotToken);
    try {
      const session = await ctx.runQuery(api.telegramAccess.getForService, { collectionId, chatId, serviceToken });
      const access = { shareToken: session.shareToken, contributorKey: session.contributorKey };
      const file = await telegram.getFile(fileId);
      if (!file.file_path || (file.file_size ?? 0) > 20 * 1024 * 1024) throw new ConvexError("Use the gallery’s web uploader for photos over 20 MB.");
      const response = await fetch(`https://api.telegram.org/file/bot${collection.telegramBotToken}/${file.file_path}`);
      if (!response.ok) throw new Error("Photo download failed");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 20 * 1024 * 1024) throw new ConvexError("Use the gallery’s web uploader for photos over 20 MB.");
      const { uploadId } = await ctx.runMutation(api.uploads.start, { collectionId, name: filename, size: bytes.length, photos: 1, access });
      const name = filename.toLowerCase().endsWith(".png") ? "photo.png" : "photo.jpg";
      const { batchId } = await ctx.runMutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name, size: bytes.length }], access });
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucket = process.env.R2_BUCKET_NAME;
      if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("Photo storage is not configured");
      const r2 = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
      await r2.send(new PutObjectCommand({ Bucket: bucket, Key: stagingKey(collectionId, batchId, name), Body: bytes, ContentType: photoType(name) }));
      await ctx.runMutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
      if (notify) await telegram.sendMessage(chatId, album
        ? "Adding your album to the gallery. Photos appear as processing finishes. You can send more photos or choose Find my photos."
        : "Photo uploaded. It will appear in the gallery after processing. You can send more photos or choose Find my photos.");
    } catch (error) {
      // Telegram errors can contain credentials, so only intentional refusals are shown.
      await telegram.sendMessage(chatId, error instanceof ConvexError ? String(error.data) : "This photo couldn’t be uploaded. Try again, or use the gallery’s web uploader.");
    }
  },
});

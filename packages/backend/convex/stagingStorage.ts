"use node";

import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { stagingKey } from "./photoKeys";

/** Release abandoned holds or processing refunds only after upload URLs expire and staged photos are gone. */
export const cleanup = internalAction({
  args: { id: v.id("uploadBatches") },
  handler: async (ctx, { id }): Promise<null> => {
    const batch = await ctx.runQuery(internal.uploads.expiredStagingBatch, { id });
    if (!batch) return null;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("Photo storage is not configured");
    const r2 = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
    const result = await r2.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.names.map((name) => ({ Key: stagingKey(batch.collectionId, id, name) })), Quiet: true },
    }));
    // S3 can return HTTP 200 with per-object errors. Releasing credit then would leave unpaid photos in storage.
    if (result.Errors?.length) throw new Error("Abandoned upload cleanup failed");
    await ctx.runMutation(internal.uploads.releaseExpiredBatch, { id });
    return null;
  },
});

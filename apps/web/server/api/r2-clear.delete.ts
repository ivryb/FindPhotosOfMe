import { defineEventHandler, createError } from "h3";
import {
  getR2Client,
  assertBucket,
  listAllObjects,
  deleteObjects,
} from "../utils/r2";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const bucket = assertBucket(config);

  console.log(
    `[${new Date().toISOString()}] Starting R2 bucket clear operation for bucket: ${bucket}`
  );

  try {
    const client = getR2Client(config);
    let totalDeleted = 0;
    const keys = await listAllObjects(client, bucket);

    if (keys.length === 0) {
      console.log(
        `[${new Date().toISOString()}] No objects found to delete in bucket: ${bucket}`
      );
    } else {
      // Delete in batches of 1000 (AWS S3 limit per request)
      const batchSize = 1000;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const deletedCount = await deleteObjects(client, bucket, batch);
        totalDeleted += deletedCount;
        console.log(
          `[${new Date().toISOString()}] Deleted ${deletedCount} objects (batch ${
            i / batchSize + 1
          }/${Math.ceil(keys.length / batchSize)})`
        );
      }
    }

    console.log(
      `[${new Date().toISOString()}] R2 bucket cleared successfully. Total objects deleted: ${totalDeleted}`
    );

    return {
      success: true,
      message: `Bucket cleared successfully. Deleted ${totalDeleted} object(s).`,
      deletedCount: totalDeleted,
    };
  } catch (error: any) {
    console.error(
      `[${new Date().toISOString()}] Error clearing R2 bucket:`,
      error
    );

    throw createError({
      statusCode: error.$metadata?.httpStatusCode || 500,
      statusMessage: error.message || "Failed to clear R2 bucket",
    });
  }
});

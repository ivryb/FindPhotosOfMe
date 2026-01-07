import { useR2 } from "../utils/r2";
import { requireAdminAuth } from "../utils/auth";

export default defineEventHandler(async (event) => {
  requireAdminAuth(event);
  console.log(
    `[${new Date().toISOString()}] Starting R2 bucket clear operation`
  );

  try {
    const r2 = useR2();
    const keys = await r2.listAllObjects();

    if (keys.length === 0) {
      console.log(`[${new Date().toISOString()}] No objects found to delete`);
      return {
        success: true,
        message: "Bucket is already empty.",
        deletedCount: 0,
      };
    }

    let totalDeleted = 0;
    const batchSize = 1000;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const deletedCount = await r2.deleteObjects(batch);
      totalDeleted += deletedCount;
      console.log(
        `[${new Date().toISOString()}] Deleted ${deletedCount} objects (batch ${
          i / batchSize + 1
        }/${Math.ceil(keys.length / batchSize)})`
      );
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

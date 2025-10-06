import { defineEventHandler, createError } from "h3";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const bucket = config.r2BucketName as string | undefined;

  let s3Client: S3Client | null = null;

  function getS3Client(config: any): S3Client {
    if (!s3Client) {
      const accountId = config.r2AccountId as string | undefined;
      const accessKeyId = config.r2AccessKeyId as string | undefined;
      const secretAccessKey = config.r2SecretAccessKey as string | undefined;

      if (!accountId || !accessKeyId || !secretAccessKey) {
        throw createError({
          statusCode: 500,
          statusMessage:
            "R2 credentials missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)",
        });
      }

      const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

      s3Client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      console.log(
        `[${new Date().toISOString()}] S3 client initialized for R2 bucket clearing`
      );
    }

    return s3Client;
  }

  if (!bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: "R2_BUCKET_NAME not configured",
    });
  }

  console.log(
    `[${new Date().toISOString()}] Starting R2 bucket clear operation for bucket: ${bucket}`
  );

  try {
    const client = getS3Client(config);
    let totalDeleted = 0;
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      });

      const listResponse = await client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        console.log(
          `[${new Date().toISOString()}] No more objects to delete. Total deleted: ${totalDeleted}`
        );
        break;
      }

      const objectsToDelete = listResponse.Contents.map((item) => ({
        Key: item.Key!,
      }));

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objectsToDelete,
        },
      });

      const deleteResponse = await client.send(deleteCommand);
      const deletedCount = deleteResponse.Deleted?.length || 0;
      totalDeleted += deletedCount;

      console.log(
        `[${new Date().toISOString()}] Deleted ${deletedCount} objects (total: ${totalDeleted})`
      );

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        console.error(
          `[${new Date().toISOString()}] Errors during deletion:`,
          deleteResponse.Errors
        );
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

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

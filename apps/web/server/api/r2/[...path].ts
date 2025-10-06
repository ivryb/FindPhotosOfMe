import { defineEventHandler, getRouterParam, setHeader, createError } from "h3";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const pathParam = getRouterParam(event, "path");

  let s3Client: S3Client | null = null;

  console.log("path param", pathParam);
  console.log(config);

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
        `[${new Date().toISOString()}] S3 client initialized for R2 bucket`
      );
    }

    return s3Client;
  }

  if (!pathParam) {
    throw createError({ statusCode: 400, statusMessage: "Missing path" });
  }

  const objectKey = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;
  const bucket = config.r2BucketName as string | undefined;

  if (!bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: "R2_BUCKET_NAME not configured",
    });
  }

  try {
    const client = getS3Client(config);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw createError({
        statusCode: 404,
        statusMessage: "Object not found or empty",
      });
    }

    // Set headers
    const contentType = response.ContentType || "application/octet-stream";
    setHeader(event, "content-type", contentType);

    if (response.CacheControl) {
      setHeader(event, "cache-control", response.CacheControl);
    }

    // Convert AWS SDK body to Node.js Readable stream
    const body = response.Body as any;
    if (body instanceof Readable) {
      return body;
    }

    // For web streams, convert to Node.js stream
    return Readable.from(body);
  } catch (error: any) {
    console.error(
      `[${new Date().toISOString()}] Error fetching R2 object ${objectKey}:`,
      error
    );

    if (error.name === "NoSuchKey") {
      throw createError({
        statusCode: 404,
        statusMessage: "Object not found",
      });
    }

    throw createError({
      statusCode: error.$metadata?.httpStatusCode || 500,
      statusMessage: error.message || "Failed to fetch object from R2",
    });
  }
});

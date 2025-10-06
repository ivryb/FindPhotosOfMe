import { createError } from "h3";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

let cachedClient: S3Client | null = null;

export function getR2Client(config: any): S3Client {
  if (cachedClient) return cachedClient;

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

  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log(
    `[${new Date().toISOString()}] S3 client initialized for R2 (endpoint: ${endpoint})`
  );

  return cachedClient;
}

export function assertBucket(config: any): string {
  const bucket = config.r2BucketName as string | undefined;
  if (!bucket) {
    throw createError({
      statusCode: 500,
      statusMessage: "R2_BUCKET_NAME not configured",
    });
  }
  return bucket;
}

export async function getObjectStream(
  client: S3Client,
  params: GetObjectCommandInput
): Promise<{
  stream: Readable;
  contentType: string;
  cacheControl?: string;
  contentLength?: number;
  lastModified?: Date;
}> {
  const response = await client.send(new GetObjectCommand(params));

  if (!response.Body) {
    throw createError({
      statusCode: 404,
      statusMessage: "Object not found or empty",
    });
  }

  const body = response.Body as any;
  const stream = body instanceof Readable ? body : Readable.from(body);

  return {
    stream,
    contentType: response.ContentType || "application/octet-stream",
    cacheControl: response.CacheControl,
    contentLength:
      typeof response.ContentLength === "number"
        ? response.ContentLength
        : undefined,
    lastModified: response.LastModified,
  };
}

export async function listAllObjects(
  client: S3Client,
  bucket: string
): Promise<string[]> {
  let keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    });
    const listResponse = await client.send(listCommand);
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      keys.push(
        ...(listResponse.Contents.map((i) => i.Key!).filter(
          Boolean
        ) as string[])
      );
    }
    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

export async function deleteObjects(
  client: S3Client,
  bucket: string,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) return 0;
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: keys.map((Key) => ({ Key })) },
  });
  const deleteResponse = await client.send(deleteCommand);
  return deleteResponse.Deleted?.length || 0;
}

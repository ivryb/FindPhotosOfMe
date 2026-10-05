import { createError } from "h3";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";
import type { H3Event } from "h3";

class R2Service {
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor(private readonly config: ReturnType<typeof useRuntimeConfig>) {}

  private initializeClient() {
    if (this.client) return;

    const config = this.config;
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

    const endpoint = (config.r2Endpoint as string) || `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: "auto",
      endpoint,
      // R2 supports bucket-in-path URLs, which also work against the tests' local fake.
      forcePathStyle: true,
      // Nitro's Workers adapter cannot use the SDK's default Node HTTPS transport.
      requestHandler: new FetchHttpHandler(),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log(
      `[${new Date().toISOString()}] R2 service initialized (endpoint: ${endpoint})`
    );
  }

  private getBucket(): string {
    if (this.bucket) return this.bucket;

    const config = this.config;
    const bucket = config.r2BucketName as string | undefined;

    if (!bucket) {
      throw createError({
        statusCode: 500,
        statusMessage: "R2_BUCKET_NAME not configured",
      });
    }

    this.bucket = bucket;
    return bucket;
  }

  async getObjectStream(objectKey: string): Promise<{
    stream: ReadableStream;
    contentType: string;
    contentLength?: number;
    lastModified?: Date;
  }> {
    this.initializeClient();
    const bucket = this.getBucket();

    const response = await this.client!.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );

    if (!response.Body) {
      throw createError({
        statusCode: 404,
        statusMessage: "Object not found or empty",
      });
    }

    const stream = response.Body.transformToWebStream();

    return {
      stream,
      contentType: response.ContentType || "application/octet-stream",
      contentLength:
        typeof response.ContentLength === "number"
          ? response.ContentLength
          : undefined,
      lastModified: response.LastModified,
    };
  }

  async getSignedUrl(
    objectKey: string,
    expiresIn: number = 3600
  ): Promise<string> {
    this.initializeClient();
    const bucket = this.getBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    return await getSignedUrl(this.client!, command, { expiresIn });
  }

  async deletePrefix(prefix: string): Promise<number> {
    this.initializeClient();
    const bucket = this.getBucket();
    let continuationToken: string | undefined;
    let deleted = 0;

    do {
      const page = await this.client!.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      const objects = (page.Contents ?? []).flatMap(({ Key }) => Key ? [{ Key }] : []);
      if (objects.length) {
        const result = await this.client!.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }));
        if (result.Errors?.length) throw new Error("Some event files could not be deleted");
        deleted += objects.length;
      }
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    return deleted;
  }

  async getUploadSignedUrl(
    objectKey: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    this.initializeClient();
    const bucket = this.getBucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    return await getSignedUrl(this.client!, command, { expiresIn });
  }

  /** Every key directly in a folder, in key order; subfolders are left out. */
  async listFolder(prefix: string) {
    this.initializeClient();
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.client!.send(new ListObjectsV2Command({
        Bucket: this.getBucket(),
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      }));
      keys.push(...(page.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : [])));
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);
    return keys;
  }
}

// Worker bindings are available during a request, so resolve credentials from its config.
export function useR2(event: H3Event): R2Service {
  return new R2Service(useRuntimeConfig(event));
}

/** The PHOTOS binding on Workers (wrangler.jsonc), much faster than R2's S3 API. Development and tests have none. */
type Bucket = {
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
  list(options: { prefix: string; delimiter: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
};
const binding = (event: H3Event): Bucket | undefined => event.context.cloudflare?.env?.PHOTOS;

/** Every key directly in a folder of the bucket, in key order; subfolders are left out. */
export async function listFolder(event: H3Event, prefix: string) {
  const bucket = binding(event);
  if (!bucket) return useR2(event).listFolder(prefix);
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, delimiter: "/", cursor });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

/** A photo to stream, or undefined if the bucket has none under this key. */
export async function readPhoto(event: H3Event, key: string): Promise<{ stream: ReadableStream; contentType: string; contentLength?: number } | undefined> {
  const bucket = binding(event);
  if (!bucket) return useR2(event).getObjectStream(key).catch(() => undefined);
  const object = await bucket.get(key);
  return object ? { stream: object.body, contentType: object.httpMetadata?.contentType ?? "application/octet-stream", contentLength: object.size } : undefined;
}

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

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: "auto",
      endpoint,
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

  async getSignedUrlWithResponse(
    objectKey: string,
    opts?: {
      filename?: string;
      contentType?: string;
      expiresIn?: number;
      cacheSeconds?: number;
      contentDisposition?: "inline" | "attachment";
    }
  ): Promise<string> {
    this.initializeClient();
    const bucket = this.getBucket();

    const expiresIn = opts?.expiresIn ?? 300;
    const contentType = opts?.contentType ?? "image/jpeg";
    const filename =
      opts?.filename ?? objectKey.split("/").pop() ?? "photo.jpg";
    const disposition = opts?.contentDisposition ?? "inline";
    const cacheControl =
      typeof opts?.cacheSeconds === "number"
        ? `public, max-age=${opts!.cacheSeconds}`
        : undefined;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ResponseContentType: contentType,
      ResponseContentDisposition: `${disposition}; filename="${filename}"`,
      ...(cacheControl ? { ResponseCacheControl: cacheControl } : {}),
    });

    const url = await getSignedUrl(this.client!, command, { expiresIn });
    console.log(
      `[${new Date().toISOString()}] Generated signed URL with response overrides (key: ${objectKey}, expiresIn: ${expiresIn}, disposition: ${disposition})`
    );
    return url;
  }
}

// Worker bindings are available during a request, so resolve credentials from its config.
export function useR2(event: H3Event): R2Service {
  return new R2Service(useRuntimeConfig(event));
}

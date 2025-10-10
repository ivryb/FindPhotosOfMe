import { createError } from "h3";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

class R2Service {
  private client: S3Client | null = null;
  private bucket: string | null = null;

  private initializeClient() {
    if (this.client) return;

    const config = useRuntimeConfig();
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

    const config = useRuntimeConfig();
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
    stream: Readable;
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

    const body = response.Body as any;
    const stream = body instanceof Readable ? body : Readable.from(body);

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

  async listAllObjects(): Promise<string[]> {
    this.initializeClient();
    const bucket = this.getBucket();

    let keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      });
      const listResponse = await this.client!.send(listCommand);
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

  async deleteObjects(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    this.initializeClient();
    const bucket = this.getBucket();

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    });
    const deleteResponse = await this.client!.send(deleteCommand);
    return deleteResponse.Deleted?.length || 0;
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
    } as any);

    const url = await getSignedUrl(this.client!, command, { expiresIn });
    console.log(
      `[${new Date().toISOString()}] Generated signed URL with response overrides (key: ${objectKey}, expiresIn: ${expiresIn}, disposition: ${disposition})`
    );
    return url;
  }
}

let r2ServiceInstance: R2Service | null = null;

export function useR2(): R2Service {
  if (!r2ServiceInstance) {
    r2ServiceInstance = new R2Service();
  }
  return r2ServiceInstance;
}

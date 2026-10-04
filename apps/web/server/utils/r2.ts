import { createError } from "h3";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { DAY } from "@FindPhotosOfMe/backend/convex/pricing";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";
import type { H3Event } from "h3";
import type { GalleryPhoto } from "#shared/types/gallery";

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

  /**
   * One page of a gallery's photos in key order, after the photo named `after`.
   * Thumbnails sit in a subfolder and the face index is skipped, so only photos come back.
   */
  async listPhotos(collectionId: string, after: string | undefined, limit: number) {
    this.initializeClient();
    const prefix = `${collectionId}/`;
    const page = await this.client!.send(new ListObjectsV2Command({
      Bucket: this.getBucket(),
      Prefix: prefix,
      Delimiter: "/",
      StartAfter: after ? prefix + after : undefined,
      MaxKeys: limit,
    }));
    const keys = (page.Contents ?? []).flatMap(({ Key }) => (Key && Key !== `${prefix}embeddings.json` ? [Key] : []));
    const last = page.Contents?.at(-1)?.Key;
    return { keys, next: page.IsTruncated && last ? last.slice(prefix.length) : null };
  }

  /**
   * Links to a photo's thumbnail, full size, and a download of it. Signed as of the start of the UTC day,
   * so they work for one to two days (long enough for a tab left open) and stay the same all day, so browsers cache them.
   */
  async photoLinks(key: string): Promise<GalleryPhoto> {
    this.initializeClient();
    const Bucket = this.getBucket();
    const slash = key.indexOf("/");
    const name = key.slice(slash + 1);
    const signingDate = new Date(Math.floor(Date.now() / DAY) * DAY);
    const sign = (command: GetObjectCommand) => getSignedUrl(this.client!, command, { expiresIn: 2 * DAY / 1000, signingDate });
    const [thumb, full, download] = await Promise.all([
      sign(new GetObjectCommand({ Bucket, Key: `${key.slice(0, slash)}/thumbs/${name}` })),
      sign(new GetObjectCommand({ Bucket, Key: key })),
      sign(new GetObjectCommand({ Bucket, Key: key, ResponseContentDisposition: `attachment; filename="${name}"` })),
    ]);
    return { key, thumb, full, download };
  }
}

// Worker bindings are available during a request, so resolve credentials from its config.
export function useR2(event: H3Event): R2Service {
  return new R2Service(useRuntimeConfig(event));
}

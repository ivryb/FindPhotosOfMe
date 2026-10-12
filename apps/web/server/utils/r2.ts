import { createError } from "h3";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { STAGING_URL_LIFETIME_MS } from "@FindPhotosOfMe/backend/convex/photoKeys";
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
      // Presigning has no photo body yet; the SDK would otherwise sign the checksum of an empty file.
      requestChecksumCalculation: "WHEN_REQUIRED",
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

  async getObjectStream(objectKey: string, range?: ByteRange): Promise<{
    stream: ReadableStream;
    contentType: string;
    contentLength?: number;
    lastModified?: Date;
    etag?: string;
    range?: Span;
  }> {
    this.initializeClient();
    const bucket = this.getBucket();

    const response = await this.client!.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Range: range && rangeHeader(range),
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
      etag: response.ETag,
      range: range && response.ContentRange ? span(range, Number(response.ContentRange.split("/")[1])) : undefined,
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

  async getUploadSignedUrl({ key, contentType, size, expiresAt }: { key: string; contentType: string; size: number; expiresAt: number }): Promise<string> {
    this.initializeClient();
    const bucket = this.getBucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    // Reissuing a URL must not extend its reservation, or cleanup could release credit while it still works.
    return getSignedUrl(this.client!, command, {
      expiresIn: STAGING_URL_LIFETIME_MS / 1000,
      signingDate: new Date(expiresAt - STAGING_URL_LIFETIME_MS),
      signableHeaders: new Set(["content-length", "content-type"]),
    });
  }

  async objectSize(key: string): Promise<number | undefined> {
    this.initializeClient();
    try {
      const object = await this.client!.send(new HeadObjectCommand({ Bucket: this.getBucket(), Key: key }));
      return object.ContentLength;
    } catch (error) {
      if (error instanceof Error && ["NotFound", "NoSuchKey"].includes(error.name)) return undefined;
      throw error;
    }
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

/** Part of a file: from `offset`, `length` bytes or to the end, or its last `suffix` bytes. R2 takes these as they are. */
export type ByteRange = { offset: number; length?: number } | { suffix: number };
/** Where a part sits in its file, as Content-Range describes it. */
type Span = { start: number; end: number; size: number };

/** The single range a request asks for, such as `bytes=0-` from a video player. Other ranges mean the whole file. */
export function byteRange(header: string | undefined): ByteRange | undefined {
  const [, from, to] = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "") ?? [];
  if (from === undefined || to === undefined) return undefined;
  if (!from) return Number(to) > 0 ? { suffix: Number(to) } : undefined;
  const offset = Number(from);
  if (!to) return { offset };
  return Number(to) >= offset ? { offset, length: Number(to) - offset + 1 } : undefined;
}

const rangeHeader = (range: ByteRange) =>
  "suffix" in range ? `bytes=-${range.suffix}` : `bytes=${range.offset}-${range.length === undefined ? "" : range.offset + range.length - 1}`;

function span(range: ByteRange, size: number): Span {
  if ("suffix" in range) return { start: Math.max(0, size - range.suffix), end: size - 1, size };
  return { start: range.offset, end: range.length === undefined ? size - 1 : Math.min(size, range.offset + range.length) - 1, size };
}

/** The production PHOTOS binding on Workers (wrangler.jsonc), faster than R2's S3 API. */
type Bucket = {
  get(key: string, options?: { range?: ByteRange }): Promise<{ body: ReadableStream; size: number; httpEtag: string; httpMetadata?: { contentType?: string } } | null>;
  list(options: { prefix: string; delimiter: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
};
// Nuxt dev also exposes PHOTOS, but it is an empty local emulator bucket. Read the configured R2 service there.
const binding = (event: H3Event): Bucket | undefined => import.meta.dev ? undefined : event.context.cloudflare?.env?.PHOTOS;

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

/** A photo to stream, or just its `range`, or undefined if the bucket has none under this key. */
export async function readPhoto(event: H3Event, key: string, range?: ByteRange): Promise<Awaited<ReturnType<R2Service["getObjectStream"]>> | undefined> {
  const bucket = binding(event);
  if (!bucket) return useR2(event).getObjectStream(key, range).catch(() => undefined);
  const object = await bucket.get(key, range && { range });
  if (!object) return undefined;
  const part = range && span(range, object.size);
  return {
    stream: object.body, contentType: object.httpMetadata?.contentType ?? "application/octet-stream", etag: object.httpEtag,
    contentLength: part ? part.end - part.start + 1 : object.size, range: part,
  };
}

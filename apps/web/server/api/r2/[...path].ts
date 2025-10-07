import { useR2 } from "../../utils/r2";
import { Readable } from "stream";

export default cachedEventHandler(
  async (event) => {
    const pathParam = getRouterParam(event, "path");

    console.log(
      `[${new Date().toISOString()}] R2 GET request path param:`,
      pathParam
    );

    if (!pathParam) {
      throw createError({ statusCode: 400, statusMessage: "Missing path" });
    }

    const objectKey = Array.isArray(pathParam)
      ? pathParam.join("/")
      : pathParam;

    try {
      const r2 = useR2();
      const { stream, contentType, contentLength, lastModified } =
        await r2.getObjectStream(objectKey);

      console.log(
        `[${new Date().toISOString()}] Fetching R2 object ${objectKey}, contentType: ${contentType}`
      );

      // Convert stream to Buffer to avoid caching serialization issues
      const chunks: Buffer[] = [];
      const readableStream = stream as unknown as Readable;

      for await (const chunk of readableStream) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);

      console.log(
        `[${new Date().toISOString()}] R2 object ${objectKey} loaded, size: ${buffer.length} bytes`
      );

      setHeader(event, "content-type", contentType);
      setHeader(event, "content-length", buffer.length);
      if (lastModified instanceof Date) {
        setHeader(event, "last-modified", lastModified.toUTCString());
      }
      setHeader(event, "cache-control", "public, max-age=604800, immutable");

      return buffer;
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
  },
  {
    maxAge: 60 * 60 * 24 * 7, // 7 days (matching the cache-control header)
    getKey: (event) => {
      const pathParam = getRouterParam(event, "path");
      const objectKey = Array.isArray(pathParam)
        ? pathParam.join("/")
        : pathParam;
      return `r2:${objectKey}`;
    },
  }
);

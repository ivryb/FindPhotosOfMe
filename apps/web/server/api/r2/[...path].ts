import { getR2Client, assertBucket, getObjectStream } from "../../utils/r2";

export default defineCachedEventHandler(
  async (event) => {
    const config = useRuntimeConfig();
    const pathParam = getRouterParam(event, "path");

    // Logging request context for diagnostics
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
    const bucket = assertBucket(config);

    try {
      const client = getR2Client(config);
      const { stream, contentType, cacheControl, contentLength, lastModified } =
        await getObjectStream(client, {
          Bucket: bucket,
          Key: objectKey,
        });

      // Set content headers
      setHeader(event, "content-type", contentType);
      if (typeof contentLength === "number") {
        setHeader(event, "content-length", contentLength as unknown as number);
      }
      if (lastModified instanceof Date) {
        setHeader(event, "last-modified", lastModified.toUTCString());
      }

      return stream;
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
    maxAge: 3600 * 24 * 7,
  }
);

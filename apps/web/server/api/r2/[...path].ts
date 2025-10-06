import { useR2 } from "../../utils/r2";

export default defineEventHandler(async (event) => {
  const pathParam = getRouterParam(event, "path");

  console.log(
    `[${new Date().toISOString()}] R2 GET request path param:`,
    pathParam
  );

  if (!pathParam) {
    throw createError({ statusCode: 400, statusMessage: "Missing path" });
  }

  const objectKey = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;

  try {
    const r2 = useR2();
    const { stream, contentType, contentLength, lastModified } =
      await r2.getObjectStream(objectKey);

    setHeader(event, "content-type", contentType);
    if (typeof contentLength === "number") {
      setHeader(event, "content-length", contentLength as unknown as number);
    }
    if (lastModified instanceof Date) {
      setHeader(event, "last-modified", lastModified.toUTCString());
    }
    setHeader(event, "cache-control", "public, max-age=604800, immutable");

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
});

import { useR2 } from "../../utils/r2";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

export default defineEventHandler(async (event) => {
  const convex = getAuthenticatedConvex(event);
  const now = new Date().toISOString();
  try {
    const body = await readBody<{
      key?: string;
      collectionId?: string;
      contentType?: string;
      expiresIn?: number;
    }>(event);

    const key = body?.key;
    const contentType = body?.contentType || "application/zip";
    const expiresIn =
      typeof body?.expiresIn === "number" ? body!.expiresIn : 3600;

    if (!key || typeof key !== "string" || !body.collectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing or invalid 'key'",
      });
    }

    await convex.query(api.collections.canUpload, {
      id: body.collectionId as Id<"collections">,
    });
    if (!key.startsWith(`uploads/${body.collectionId}/`)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid upload path" });
    }

    if (key.includes("..")) {
      throw createError({ statusCode: 400, statusMessage: "Invalid key" });
    }

    const r2 = useR2(event);
    const url = await r2.getUploadSignedUrl(key, contentType, expiresIn);

    console.log(`[${now}] R2 presign upload generated for key: ${key}`);

    return {
      success: true,
      method: "PUT",
      url,
      key,
      headers: {
        "Content-Type": contentType,
      },
      expiresIn,
    };
  } catch (error: any) {
    console.error(`[${now}] Error generating presign upload URL:`, error);
    throw createError({
      statusCode: error.$metadata?.httpStatusCode || 500,
      statusMessage: error.message || "Failed to generate presigned upload URL",
    });
  }
});

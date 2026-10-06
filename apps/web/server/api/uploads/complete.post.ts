import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { stagingKey } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

type Body = { batchId?: FunctionArgs<typeof api.uploads.getStagingBatch>["id"]; access?: FunctionArgs<typeof api.uploads.getStagingBatch>["access"] };

/** Only the server can turn a reservation into queued work, after verifying the files actually arrived. */
export default defineEventHandler(async (event) => {
  const { batchId, access } = (await readBody<Body>(event)) ?? {};
  if (typeof batchId !== "string" || !batchId) throw createError({ statusCode: 400, statusMessage: "Invalid upload batch" });
  const config = useRuntimeConfig(event);
  const convex = access ? new ConvexHttpClient(config.public.convexUrl) : getAuthenticatedConvex(event);
  setHeader(event, "Cache-Control", "private, no-store");
  try {
    const batch = await convex.query(api.uploads.getStagingBatch, { id: batchId, access });
    // A lost completion response can be retried after the worker has already removed its source files.
    if (batch.status !== "staging") return { ok: true };
    const r2 = useR2(event);
    const sizes = await Promise.all(batch.names.map((name) => r2.objectSize(stagingKey(batch.collectionId, batch.batchId, name))));
    if (sizes.some((size, index) => size !== batch.sizes[index])) {
      throw createError({ statusCode: 409, statusMessage: "Some photos have not finished uploading. Choose the same files to try again." });
    }
    await convex.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken: config.serviceToken });
    return { ok: true };
  } catch (error) {
    if (error instanceof ConvexError) throw createError({ statusCode: 409, statusMessage: String(error.data) });
    throw error;
  }
});

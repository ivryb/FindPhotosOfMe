import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const dispatchNextForCollection = internalAction({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, { collectionId }): Promise<{ dispatched: false } | { dispatched: true; jobId: Id<"ingestJobs"> }> => {
    const apiUrl = process.env.PYTHON_API_URL;
    const serviceToken = process.env.SERVICE_TOKEN;
    if (!apiUrl || !serviceToken) throw new Error("Processing service is not configured");
    const claim = await ctx.runMutation(internal.ingestJobs.claimNextForCollection, { collectionId });
    if (!claim) return { dispatched: false };

    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/process-ingest-job`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        job_id: claim._id,
        collection_id: claim.collectionId,
        file_key: claim.fileKey,
      }),
    }).catch(() => undefined);

    // A claimed job the service never got would stay running and block the gallery's later uploads.
    if (!response?.ok) {
      await ctx.runMutation(internal.ingestJobs.markUndelivered, { id: claim._id });
      return { dispatched: false };
    }
    return { dispatched: true, jobId: claim._id };
  },
});

import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const dispatchNextForCollection = action({
  args: { collectionId: v.id("collections") },
  returns: v.object({
    dispatched: v.boolean(),
    jobId: v.optional(v.id("ingestJobs")),
  }),
  handler: async (ctx, args): Promise<{ dispatched: boolean; jobId?: any }> => {
    // Atomically claim next job (enforces per-collection sequential processing)
    const claim: {
      _id: any;
      collectionId: any;
      fileKey: string;
      filename: string;
    } | null = await ctx.runMutation(api.ingestJobs.claimNextForCollection, {
      collectionId: args.collectionId,
    });

    if (!claim) {
      console.log("[Ingest] No job to dispatch", {
        collectionId: args.collectionId,
      });
      return { dispatched: false } as const;
    }

    const apiUrl =
      process.env.PYTHON_API_URL ||
      process.env.API_URL ||
      process.env.NUXT_PUBLIC_API_URL;
    if (!apiUrl) throw new Error("API URL not configured");

    const payload = {
      job_id: claim._id,
      collection_id: claim.collectionId,
      file_key: claim.fileKey,
    } as const;

    // Fire-and-forget start; Python runs the job and reports progress to Convex
    const url = `${apiUrl.replace(/\/$/, "")}/api/process-ingest-job`;
    console.log("[Ingest] Dispatching job to Python", { url, payload });
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return { dispatched: true, jobId: claim._id } as const;
  },
});

export const requestNextForCollection = mutation({
  args: { collectionId: v.id("collections") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    console.log("[Ingest] Scheduling next job dispatch", {
      collectionId: args.collectionId,
    });
    await ctx.scheduler.runAfter(0, api.ingest.dispatchNextForCollection, {
      collectionId: args.collectionId,
    });
    return null;
  },
});

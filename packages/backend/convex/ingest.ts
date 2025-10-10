import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Workpool } from "@convex-dev/workpool";
import { api, components, internal } from "./_generated/api";

const ingestPool = new Workpool(components.ingestWorkpool, {
  maxParallelism: 1,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 1, initialBackoffMs: 1500, base: 2 },
});

export const enqueueIngestJobs = action({
  args: {
    jobs: v.array(
      v.object({
        jobId: v.id("ingestJobs"),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Enqueue each job to the workpool, calling internal.ingest.processJob
    await ingestPool.enqueueActionBatch(
      ctx,
      internal.ingest.processJob,
      args.jobs.map((j) => ({ jobId: j.jobId })),
      {
        onComplete: internal.ingest.onJobComplete,
        // Provide jobId into onComplete context for error fallback handling
        context: ((workArgs: { jobId: string }) => ({
          jobId: workArgs.jobId,
        })) as any,
      }
    );
    return null;
  },
});

export const processJob = internalAction({
  args: { jobId: v.id("ingestJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Mark job running
    await ctx.runMutation(api.ingestJobs.updateProgress, {
      id: args.jobId,
      status: "running",
    });

    const job = await ctx
      .runQuery(api.ingestJobs.get, { id: args.jobId })
      .catch(() => null);
    // If no direct get, read via list filtered (fallback)
    let jobDoc: any = job;
    if (!jobDoc) {
      // simple fetch from db to avoid missing get helper
      // This code path should not be hit if we define get below
      throw new Error("Job not found");
    }

    // Fetch collection to ensure exists
    const collection = await ctx.runQuery(api.collections.get, {
      id: jobDoc.collectionId,
    });
    if (!collection) throw new Error("Collection not found for job");

    // Call Python processing service
    const apiUrl = process.env.API_URL;
    if (!apiUrl) throw new Error("API URL not configured");

    const payload = {
      job_id: args.jobId,
      collection_id: jobDoc.collectionId,
      file_key: jobDoc.fileKey,
    } as any;

    console.log("Ingest process start", payload);
    const res = await fetch(`${apiUrl}/api/process-ingest-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Python ingest failed: ${res.status} ${text}`);
    }

    console.log("Ingest process dispatched", { jobId: args.jobId });
    return null;
  },
});

export const onJobComplete = ingestPool.defineOnComplete({
  context: v.object({ jobId: v.id("ingestJobs") }),
  handler: async (ctx, { workId, context, result }) => {
    // If the action failed before Python handled it, persist error on the job
    if (result.kind === "failed") {
      await ctx.runMutation(api.ingestJobs.updateProgress, {
        id: context.jobId,
        status: "failed",
        error: result.error,
      });
    }
    if (result.kind === "canceled") {
      await ctx.runMutation(api.ingestJobs.updateProgress, {
        id: context.jobId,
        status: "canceled",
        error: "Canceled by system",
      });
    }
  },
});

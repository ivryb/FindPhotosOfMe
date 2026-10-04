import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Retries photo batches and merges whose workers went quiet; see uploads.ts.
crons.interval("recover photo processing", { minutes: 2 }, internal.uploads.recover, {});

export default crons;

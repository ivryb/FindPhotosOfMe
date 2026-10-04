import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireCollectionOwner, requireServiceToken } from "./authz";
import {
  DAY,
  EXTENSION_DAYS,
  PRICES,
  TRIAL_CREDIT,
  extensionCost,
  formatMoney,
} from "./pricing";

// Each account has one balance in mills, shared by all its galleries. Every change is a balance entry,
// so charges can be traced and a repeated request (a webhook redelivery, a replayed job) applies once.

type Reason = Doc<"balanceEntries">["reason"];
type Entry = { userId: string; amount: number; reason: Reason; collectionId?: Id<"collections">; sourceId?: string };

/** The account's balance, opened with trial credit on first use. */
export async function balanceFor(ctx: MutationCtx, userId: string) {
  const existing = await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  if (existing) return existing;
  const id = await ctx.db.insert("balances", { userId, credit: TRIAL_CREDIT, paid: false });
  await ctx.db.insert("balanceEntries", { userId, amount: TRIAL_CREDIT, reason: "trial", createdAt: Date.now() });
  return (await ctx.db.get(id))!;
}

export async function findEntry(ctx: MutationCtx, sourceId: string, reason: Reason) {
  return ctx.db
    .query("balanceEntries")
    .withIndex("by_source", (q) => q.eq("sourceId", sourceId).eq("reason", reason))
    .unique();
}

/** Adds an entry and moves the balance by its amount. Returns false if this source already has one. */
export async function applyEntry(ctx: MutationCtx, entry: Entry) {
  if (entry.sourceId && (await findEntry(ctx, entry.sourceId, entry.reason))) return false;
  const balance = await balanceFor(ctx, entry.userId);
  await ctx.db.patch(balance._id, { credit: balance.credit + entry.amount });
  await ctx.db.insert("balanceEntries", { ...entry, createdAt: Date.now() });
  return true;
}

/** Takes `cost` from the balance, or throws `message(credit)` when the balance can't cover it. The message reaches people as is. */
export async function charge(ctx: MutationCtx, entry: Omit<Entry, "amount">, cost: number, message: (credit: number) => string) {
  if (entry.sourceId && (await findEntry(ctx, entry.sourceId, entry.reason))) return;
  const balance = await balanceFor(ctx, entry.userId);
  if (balance.credit < cost) throw new ConvexError(message(balance.credit));
  await applyEntry(ctx, { ...entry, amount: -cost });
}

/** Charges the gallery owner for one search. Galleries from before accounts existed have no owner and search free. */
export async function chargeSearch(ctx: MutationCtx, collection: Doc<"collections">, requestId: Id<"searchRequests">) {
  if (!collection.createdBy) return;
  await charge(
    ctx,
    { userId: collection.createdBy, reason: "search", collectionId: collection._id, sourceId: requestId },
    PRICES.search,
    () => "Searching is paused for this gallery. Please ask its owner to top up.",
  );
}

/** Gives a failed search back to the gallery owner. */
export async function returnSearch(ctx: MutationCtx, request: Doc<"searchRequests">) {
  const charged = await findEntry(ctx, request._id, "search");
  if (!charged) return;
  await applyEntry(ctx, { userId: charged.userId, amount: -charged.amount, reason: "search_returned", collectionId: request.collectionId, sourceId: request._id });
}

/** One upload attempt; a retry is a new attempt and is charged again, a replay of the same attempt is not. */
export const ingestAttempt = (job: Doc<"ingestJobs">) => `${job._id}#${job.attempt ?? 0}`;

/** Returns what an upload attempt reserved, less the photos it kept. Kept photos stay paid for. */
export async function settleIngest(ctx: MutationCtx, job: Doc<"ingestJobs">, savedImages: number) {
  const attempt = ingestAttempt(job);
  const reserved = await findEntry(ctx, attempt, "photos");
  if (!reserved) return;
  const returned = -reserved.amount - savedImages * PRICES.photo;
  if (returned <= 0) return;
  await applyEntry(ctx, { userId: reserved.userId, amount: returned, reason: "photos_returned", collectionId: job.collectionId, sourceId: attempt });
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const balance = await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    // Before the balance opens, show the trial credit it will open with.
    return { credit: balance?.credit ?? TRIAL_CREDIT, paid: balance?.paid ?? false };
  },
});

/** Reserves the photos in an upload before processing starts. Called by the processing service once it has counted them. */
export const reserveIngestForService = mutation({
  args: { jobId: v.id("ingestJobs"), images: v.number(), serviceToken: v.string() },
  handler: async (ctx, { jobId, images, serviceToken }) => {
    requireServiceToken(serviceToken);
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Upload not found");
    const collection = await ctx.db.get(job.collectionId);
    if (!collection) throw new Error("Gallery not found");
    if (!collection.createdBy) return;
    const cost = images * PRICES.photo;
    await charge(
      ctx,
      { userId: collection.createdBy, reason: "photos", collectionId: collection._id, sourceId: ingestAttempt(job) },
      cost,
      (credit) => `This ZIP has ${images.toLocaleString("en-US")} photos (${formatMoney(cost)}), but your balance is ${formatMoney(credit)}. Top up, then upload it again.`,
    );
  },
});

/** Keeps a gallery online for another 30 days, paid from the balance. An expired gallery comes back online. */
export const extendStorage = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, { id }) => {
    const { user, collection } = await requireCollectionOwner(ctx, id);
    if (collection.paymentStatus === "refunded") throw new ConvexError("This gallery was refunded and can't be kept online.");
    const cost = extensionCost(collection);
    await charge(ctx, { userId: user._id, reason: "storage", collectionId: id }, cost,
      (credit) => `Another ${EXTENSION_DAYS} days costs ${formatMoney(cost)}, but your balance is ${formatMoney(credit)}.`);
    const from = Math.max(collection.expiresAt ?? Date.now(), Date.now());
    await ctx.db.patch(id, { expiresAt: from + EXTENSION_DAYS * DAY });
  },
});

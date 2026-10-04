import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireCollectionOwner } from "./authz";
import {
  DAY,
  EXTENSION_DAYS,
  INCLUDED_DAYS,
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

/** Marks the account as paying, the first time it adds money, and gives galleries made during the trial their full included time. */
export async function endTrial(ctx: MutationCtx, userId: string) {
  const balance = await balanceFor(ctx, userId);
  if (balance.paid) return;
  await ctx.db.patch(balance._id, { paid: true });
  const galleries = await ctx.db.query("collections").withIndex("by_created_by", (q) => q.eq("createdBy", userId)).collect();
  for (const gallery of galleries.filter((gallery) => gallery.trial)) {
    const included = gallery._creationTime + INCLUDED_DAYS * DAY;
    await ctx.db.patch(gallery._id, { trial: undefined, expiresAt: Math.max(gallery.expiresAt ?? 0, included) });
  }
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

/** Throws `message(credit)` unless the account can pay `cost`. Nothing is taken. The message reaches people as is. */
export async function requireCredit(ctx: MutationCtx, userId: string, cost: number, message: (credit: number) => string) {
  const balance = await balanceFor(ctx, userId);
  if (balance.credit < cost) throw new ConvexError(message(balance.credit));
}

/** Takes `cost` from the balance, or throws `message(credit)` when the balance can't cover it. */
export async function charge(ctx: MutationCtx, entry: Omit<Entry, "amount">, cost: number, message: (credit: number) => string) {
  if (entry.sourceId && (await findEntry(ctx, entry.sourceId, entry.reason))) return;
  await requireCredit(ctx, entry.userId, cost, message);
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

/** Returns photos of a batch to its owner: those without faces, or all of them when the batch is given up. */
export async function returnPhotos(ctx: MutationCtx, batch: Doc<"uploadBatches">, photos: number) {
  const charged = await findEntry(ctx, batch._id, "photos");
  if (!charged || !photos) return;
  await applyEntry(ctx, { userId: charged.userId, amount: photos * PRICES.photo, reason: "photos_returned", collectionId: batch.collectionId, sourceId: batch._id });
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

/**
 * Adds credit to an account by hand, such as the admin's own while payments aren't open. The amount is in mills
 * ($100 is 100000): `bunx convex run balances:grant '{"email":"you@example.com","amount":100000}'`.
 * It counts as adding money, so the account's galleries leave the trial.
 */
export const grant = internalMutation({
  args: { email: v.string(), amount: v.number() },
  returns: v.string(),
  handler: async (ctx, { email, amount }) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email.trim().toLowerCase() }],
    });
    if (!user) throw new Error(`No account uses ${email}. Sign in once first.`);
    await applyEntry(ctx, { userId: user._id, amount, reason: "grant" });
    await endTrial(ctx, user._id);
    return `${email} now has ${formatMoney((await balanceFor(ctx, user._id)).credit)}`;
  },
});

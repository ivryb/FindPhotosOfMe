import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireCollectionOwner } from "./authz";
import { DAY, INCLUDED_DAYS, PRICES, TRIAL_CREDIT, dailyStorageCost, formatMoney } from "./pricing";

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
    await ctx.db.patch(gallery._id, { trial: undefined, expiresAt: Math.max(gallery.expiresAt ?? 0, included), storagePaidUntil: included });
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
  const available = availableCredit(balance);
  if (available < cost) throw new ConvexError(message(available));
}

/** Upload holds cannot also pay for another upload, a search, or storage. */
const availableCredit = (balance: Pick<Doc<"balances">, "credit" | "reserved">) => balance.credit - (balance.reserved ?? 0);

/** Holds credit before issuing upload URLs. The batch owns the hold until completion or storage cleanup. */
export async function reservePhotos(ctx: MutationCtx, userId: string, photos: number, message: (credit: number) => string) {
  await requireCredit(ctx, userId, photos * PRICES.photo, message);
  const balance = await balanceFor(ctx, userId);
  await ctx.db.patch(balance._id, { reserved: (balance.reserved ?? 0) + photos * PRICES.photo });
}

/** Call only while moving a staging batch to another state or deleting it, in the same mutation. */
export async function releasePhotos(ctx: MutationCtx, userId: string, photos: number) {
  const balance = await balanceFor(ctx, userId);
  await ctx.db.patch(balance._id, { reserved: (balance.reserved ?? 0) - photos * PRICES.photo });
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

/** Returns rejected photos after their storage grant expires. Otherwise a refund could buy new grants while old ones still work. */
export async function returnPhotos(ctx: MutationCtx, batch: Doc<"uploadBatches">, photos: number) {
  if (!photos) return;
  if (batch.staging) {
    await ctx.db.patch(batch._id, { refundPending: photos });
    return;
  }
  await returnPhotosNow(ctx, batch, photos);
}

/** Storage cleanup and owner deletion call this after removing the batch's files. Legacy batches have no live upload grants. */
export async function returnPhotosNow(ctx: MutationCtx, batch: Doc<"uploadBatches">, photos: number) {
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
    return { credit: balance ? availableCredit(balance) : TRIAL_CREDIT, paid: balance?.paid ?? false };
  },
});

/**
 * Sets the date a gallery goes offline. Nothing is charged here: chargeStorage takes each day past the paid time,
 * so a later date only means more days of that. An offline gallery comes back online if the balance covers a day.
 */
export const keepOnlineUntil = mutation({
  args: { id: v.id("collections"), until: v.number() },
  returns: v.null(),
  handler: async (ctx, { id, until }) => {
    const { user, collection } = await requireCollectionOwner(ctx, id);
    if (collection.paymentStatus === "refunded") throw new ConvexError("This gallery was refunded and can't be kept online.");
    if (collection.trial) throw new ConvexError("Top up to keep this gallery online longer.");
    const now = Date.now();
    if (until <= now) throw new ConvexError("Choose a date after today.");
    // Days the gallery spent offline aren't charged: paid time picks up from now.
    const paidUntil = Math.max(collection.storagePaidUntil ?? collection.expiresAt ?? now, now);
    if (until > paidUntil) {
      const cost = dailyStorageCost(collection);
      await requireCredit(ctx, user._id, cost,
        (credit) => `Keeping it online costs ${formatMoney(cost)} a day, but your balance is ${formatMoney(credit)}.`);
    }
    await ctx.db.patch(id, { expiresAt: until, storagePaidUntil: paidUntil });
    return null;
  },
});

/**
 * Takes a day of storage from the owner's balance for each online gallery whose paid time has run out, at its current
 * size. A gallery the balance can't cover goes offline. Runs every hour, so it reads every online gallery each time.
 */
export const chargeStorage = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const online = await ctx.db.query("collections").withIndex("by_expires_at", (q) => q.gt("expiresAt", now)).collect();
    for (const gallery of online) await chargeDays(ctx, gallery, now);
    return null;
  },
});

/** Charges a gallery each day from its paid time up to now, so a missed run catches up. */
async function chargeDays(ctx: MutationCtx, gallery: Doc<"collections">, now: number) {
  const { createdBy: owner, expiresAt } = gallery;
  // Trial time is free, refunded galleries keep the time they had, and galleries without an owner predate billing.
  if (!owner || !expiresAt || gallery.trial || gallery.paymentStatus === "refunded") return;
  const start = gallery.storagePaidUntil ?? expiresAt;
  const cost = dailyStorageCost(gallery);
  let paidUntil = start;
  while (paidUntil <= now && paidUntil < expiresAt) {
    if (availableCredit(await balanceFor(ctx, owner)) < cost) {
      await ctx.db.patch(gallery._id, { expiresAt: now, storagePaidUntil: paidUntil });
      return;
    }
    if (cost) await applyEntry(ctx, { userId: owner, amount: -cost, reason: "storage", collectionId: gallery._id });
    paidUntil += DAY;
  }
  if (paidUntil !== start) await ctx.db.patch(gallery._id, { storagePaidUntil: paidUntil });
}

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

import { internalMutation } from "./_generated/server";
import { applyEntry, balanceFor } from "./balances";
import { PRICES } from "./pricing";

/**
 * Moves galleries from per-gallery plans to account balances. Run once per deployment:
 * `bunx convex run migrations:moveToBalance`. Paid plans hand their unused photos to the owner's
 * balance and keep their end date; trial galleries keep theirs too. Safe to run again.
 */
export const moveToBalance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const galleries = await ctx.db.query("collections").collect();
    let moved = 0;
    for (const gallery of galleries) {
      if (!gallery.plan && gallery.photoLimit === undefined) continue;
      if (gallery.createdBy) {
        const balance = await balanceFor(ctx, gallery.createdBy);
        const paid = gallery.plan === "event" || gallery.plan === "large";
        if (paid && gallery.paymentStatus !== "refunded") {
          const unused = Math.max(0, (gallery.photoLimit ?? 0) - gallery.imagesCount);
          await applyEntry(ctx, { userId: gallery.createdBy, amount: unused * PRICES.photo, reason: "migration", collectionId: gallery._id, sourceId: gallery._id });
          if (!balance.paid) await ctx.db.patch(balance._id, { paid: true });
        }
      }
      await ctx.db.patch(gallery._id, { plan: undefined, photoLimit: undefined, trial: gallery.plan === "demo" ? true : undefined });
      moved++;
    }
    return { moved };
  },
});

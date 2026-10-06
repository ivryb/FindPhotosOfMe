import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireCollectionOwner(ctx: QueryCtx | MutationCtx, id: Id<"collections">) {
  const [user, collection] = await Promise.all([
    requireUser(ctx),
    ctx.db.get(id),
  ]);

  if (!collection) throw new Error("Collection not found");

  const canClaimLegacy =
    !collection.createdBy &&
    Boolean(process.env.LEGACY_OWNER_EMAIL) &&
    user.email === process.env.LEGACY_OWNER_EMAIL;

  if (collection.createdBy !== user._id && !canClaimLegacy) {
    throw new Error("Not authorized");
  }

  return { user, collection, canClaimLegacy };
}

export function requireServiceToken(token: string) {
  const expected = process.env.SERVICE_TOKEN;
  if (!expected || token !== expected) throw new Error("Not authorized");
}

export function requireActiveCollection(collection: Doc<"collections">) {
  if (collection.paymentStatus === "refunded") {
    throw new ConvexError("This gallery was refunded and is no longer active.");
  }
  if (collection.expiresAt && collection.expiresAt <= Date.now()) {
    throw new ConvexError("This gallery is offline.");
  }
}

/** A secret link is a capability, checked at every guest entry point, including media. */
export function canAccessGallery(collection: Doc<"collections"> | null, shareToken?: string) {
  if (!collection || collection.published === false) return false;
  try { requireActiveCollection(collection); } catch { return false; }
  return collection.sharing === "link"
    ? Boolean(collection.shareToken && shareToken === collection.shareToken)
    : Boolean(collection.subdomain);
}

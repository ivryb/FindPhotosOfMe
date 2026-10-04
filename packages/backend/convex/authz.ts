import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

export async function requireUser(ctx: any) {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireCollectionOwner(ctx: any, id: Id<"collections">) {
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

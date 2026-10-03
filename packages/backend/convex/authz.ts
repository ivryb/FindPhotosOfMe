import type { Id } from "./_generated/dataModel";
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

export function requireActiveCollection(collection: any) {
  if (collection.paymentStatus === "refunded") {
    throw new Error("This event was refunded and is no longer active");
  }
  if (collection.expiresAt && collection.expiresAt <= Date.now()) {
    throw new Error("This event has expired");
  }
}

export function requirePhotoCapacity(collection: any, additionalImages = 0) {
  requireActiveCollection(collection);
  if (
    collection.photoLimit &&
    collection.imagesCount + additionalImages > collection.photoLimit
  ) {
    throw new Error(`This event is limited to ${collection.photoLimit.toLocaleString()} photos`);
  }
}

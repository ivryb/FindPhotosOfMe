import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

export type Gallery = Doc<"collections">;
export type StatusTone = "ok" | "busy" | "bad" | "idle";

/** What a gallery's owner sees about it at a glance. */
export function galleryStatus(gallery: Gallery, now = Date.now()): { label: string; tone: StatusTone } {
  if (gallery.paymentStatus === "refunded") return { label: "Refunded", tone: "bad" };
  if (gallery.expiresAt && gallery.expiresAt <= now) return { label: "Offline", tone: "idle" };
  if (gallery.status === "processing") return { label: "Finding faces", tone: "busy" };
  if (gallery.status === "error") return { label: "An upload failed", tone: "bad" };
  if (!gallery.imagesCount) return { label: "No photos yet", tone: "idle" };
  return { label: "Ready", tone: "ok" };
}

export const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { count } from "./pricing";

export type Gallery = Doc<"collections">;
export type StatusTone = "ok" | "busy" | "bad" | "idle";

/** What a gallery's owner sees about it at a glance. */
export function galleryStatus(gallery: Gallery, now = Date.now()): { label: string; tone: StatusTone } {
  if (gallery.paymentStatus === "refunded") return { label: "Refunded", tone: "bad" };
  if (gallery.expiresAt && gallery.expiresAt <= now) return { label: "Offline", tone: "idle" };
  if (gallery.status === "processing") return { label: "Finding faces", tone: "busy" };
  if (gallery.status === "error") return { label: "An upload failed", tone: "bad" };
  if (!gallery.imagesCount && !gallery.videosCount) return { label: "No photos yet", tone: "idle" };
  return { label: "Ready", tone: "ok" };
}

/** How many photos and videos a gallery has, in words, such as "120 photos and 3 videos". */
export function mediaCount({ imagesCount, videosCount = 0 }: { imagesCount: number; videosCount?: number }) {
  const counted = (n: number, word: string) => `${count.format(n)} ${word}${n === 1 ? "" : "s"}`;
  if (!videosCount) return counted(imagesCount, "photo");
  return imagesCount ? `${counted(imagesCount, "photo")} and ${counted(videosCount, "video")}` : counted(videosCount, "video");
}

export const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

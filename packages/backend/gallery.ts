import type { Doc } from "./convex/_generated/dataModel";

/** The same sharing choice is used by QR codes, dashboard links, and the Telegram bot. */
export function galleryUrl(gallery: Pick<Doc<"collections">, "sharing" | "shareToken" | "subdomain">, origin: string) {
  if (gallery.sharing === "link") return gallery.shareToken ? `${origin}/gallery/${gallery.shareToken}` : "";
  if (!gallery.subdomain) return "";
  const root = new URL(origin);
  if (root.hostname === "localhost" || root.hostname === "127.0.0.1") return `${origin}/search?subdomain=${gallery.subdomain}`;
  return `${root.protocol}//${gallery.subdomain}.${root.host}`;
}

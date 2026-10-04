import { DAY } from "@FindPhotosOfMe/backend/convex/pricing";
import type { H3Event } from "h3";
import type { GalleryPhoto } from "#shared/types/gallery";

// Photos reach browsers through /media on this site, so Cloudflare's edge cache can keep them close to people.
// Pages and searches decide which photos someone may see and hand out signed links; /media only checks the
// signature, so serving a photo never waits on Convex. Links are signed for the UTC day and work for two days,
// long enough for a tab left open, and stay the same all day, so caches can reuse them.

const encoder = new TextEncoder();

/** A photo's thumbnail, full size, and a download of it, as signed /media links. */
export async function photoLinks(event: H3Event, key: string): Promise<GalleryPhoto> {
  const slash = key.indexOf("/");
  const [thumb, full, download] = await Promise.all([
    mediaLink(event, `${key.slice(0, slash)}/thumbs/${key.slice(slash + 1)}`),
    mediaLink(event, key),
    mediaLink(event, key, true),
  ]);
  return { key, thumb, full, download };
}

async function mediaLink(event: H3Event, key: string, download = false) {
  const day = Math.floor(Date.now() / DAY);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(event), message(key, day, download));
  const query = new URLSearchParams({ d: String(day), s: Buffer.from(signature).toString("base64url") });
  if (download) query.set("download", "1");
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}?${query}`;
}

/** Whether a /media link was signed here, for this photo, today or yesterday. */
export async function isSignedMediaLink(event: H3Event, key: string, day: number, signature: string, download: boolean) {
  const today = Math.floor(Date.now() / DAY);
  if (day !== today && day !== today - 1) return false;
  return crypto.subtle.verify("HMAC", await signingKey(event), Buffer.from(signature, "base64url"), message(key, day, download));
}

const message = (key: string, day: number, download: boolean) => encoder.encode(`${key}\n${day}\n${download ? "download" : "view"}`);

// Derived from the R2 secret, which only this server holds, so links need no secret of their own to configure.
const signingKey = (event: H3Event) => crypto.subtle.importKey(
  "raw",
  encoder.encode(`media links:${useRuntimeConfig(event).r2SecretAccessKey}`),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

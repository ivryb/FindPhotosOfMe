import { DAY } from "@FindPhotosOfMe/backend/convex/pricing";
import type { H3Event } from "h3";
import type { GalleryPhoto } from "#shared/types/gallery";
import { mediaLinks } from "#shared/utils/media";

// Photos reach browsers through /media on this site, so Cloudflare's edge cache can keep them close to people.
// Pages and searches decide which photos someone may see and hand out signed links; /media only checks the
// signature, so serving a photo never waits on Convex. Links are signed for the UTC day and work for two days,
// long enough for a tab left open, and stay the same all day, so caches can reuse them.
//
// A signature is for viewing (the photo and its thumbnail) or downloading, and covers one photo or, in links with
// g=1, every photo of a gallery that shows them all, so a whole gallery's links need only two signatures.
// Preview-only galleries are signed photo by photo: camera file names are guessable, so a gallery-wide link
// would open the photos they hide.

type Use = "view" | "download";
/** What a /media link carries besides the photo's key. */
export type MediaLink = { day: number; signature: unknown; gallery: boolean; download: boolean };

const encoder = new TextEncoder();

/** A photo's thumbnail, full size, and download links, signed for this photo alone. */
export async function photoLinks(event: H3Event, key: string): Promise<GalleryPhoto> {
  const [view, download] = await Promise.all([signedQuery(event, key, "view"), signedQuery(event, key, "download")]);
  return mediaLinks(key, view, download);
}

/** The query strings that sign links to every photo of a gallery, for mediaLinks. Only for galleries that show all their photos. */
export async function galleryLinks(event: H3Event, galleryId: string) {
  const [view, download] = await Promise.all([signedQuery(event, `${galleryId}/`, "view"), signedQuery(event, `${galleryId}/`, "download")]);
  return { view, download };
}

/** Whether a /media link was signed here, today or yesterday, for this photo or its gallery, and this use. */
export async function isSignedMediaLink(event: H3Event, key: string, link: MediaLink) {
  const today = Math.floor(Date.now() / DAY);
  const scope = link.gallery ? galleryScope(key) : photoOf(key);
  if (!scope || typeof link.signature !== "string" || (link.day !== today && link.day !== today - 1)) return false;
  const use = link.download ? "download" : "view";
  return crypto.subtle.verify("HMAC", await signingKey(event), Buffer.from(link.signature, "base64url"), message(scope, link.day, use));
}

/** A photo directly in a gallery's folder, as the gallery lists them. Thumbnails and the face index aren't. */
export const isGalleryPhoto = (key: string) => /^[^/]+\/[^/]+\.(jpe?g|png|bmp)$/i.test(key);

/** The photo a /media key shows: the key itself, or the photo a thumbnail was made from. */
const photoOf = (key: string) => key.replace(/^([^/]+)\/thumbs\//, "$1/");

/** The scope of gallery-wide links that open this key: its gallery's folder, for its photos and their thumbnails only. */
function galleryScope(key: string) {
  const photo = photoOf(key);
  return isGalleryPhoto(photo) ? photo.slice(0, photo.indexOf("/") + 1) : undefined;
}

// A gallery's scope ends with "/" and a photo's key never does, so one can't pass for the other.
async function signedQuery(event: H3Event, scope: string, use: Use) {
  const day = Math.floor(Date.now() / DAY);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(event), message(scope, day, use));
  const query = new URLSearchParams({ d: String(day), s: Buffer.from(signature).toString("base64url") });
  if (scope.endsWith("/")) query.set("g", "1");
  if (use === "download") query.set("download", "1");
  return query.toString();
}

const message = (scope: string, day: number, use: Use) => encoder.encode(`${scope}\n${day}\n${use}`);

// Derived from the R2 secret, which only this server holds, so links need no secret of their own to configure.
const signingKey = (event: H3Event) => crypto.subtle.importKey(
  "raw",
  encoder.encode(`media links:${useRuntimeConfig(event).r2SecretAccessKey}`),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

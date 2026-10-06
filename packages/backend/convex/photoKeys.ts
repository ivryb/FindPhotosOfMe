// Where uploaded photos live in R2, shared by Convex, the web app, and (through Convex) the processing workers.
// The browser uploads each photo to a staging key; a worker keeps valid photos according to the gallery's policy.

/** Photos the browser registers at a time, and the work one processing worker takes on. */
export const BATCH_PHOTOS = 50;
/** Larger photos are skipped when an upload is read. */
export const MAX_PHOTO_BYTES = 50 * 1024 ** 2;
/** Retries share this original URL expiry, so abandoned reservations can be released safely. */
export const STAGING_URL_LIFETIME_MS = 15 * 60 * 1000;
/** A photo's name inside its upload: what the browser makes of its file name. */
export const PHOTO_NAME = /^[A-Za-z0-9._-]{1,200}\.(jpe?g|png)$/i;

/** The content type a photo is uploaded with; its upload link is signed for it. */
export const photoType = (name: string) => (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

/** A batch's upload area. Legacy batches use their upload ID instead of their batch ID. */
export const stagingKey = (collectionId: string, sourceId: string, name: string) => `uploads/${collectionId}/${sourceId}/${name}`;

/** A processed photo in its gallery. The upload's tag keeps two uploads' IMG_0001.jpg apart. */
export const photoKey = (collectionId: string, uploadId: string, name: string) => `${collectionId}/${uploadId.slice(-8)}-${name}`;

/** An original photo directly inside a gallery, excluding indexes and other stored files. */
export const isGalleryPhoto = (key: string) => /^[^/]+\/[^/]+\.(jpe?g|png|bmp)$/i.test(key);

/** The original photo that a media key shows, including when the key points at its thumbnail. */
export function originalPhotoKey(key: string) {
  const original = key.replace(/^([^/]+)\/thumbs\//, "$1/");
  return isGalleryPhoto(original) ? original : undefined;
}

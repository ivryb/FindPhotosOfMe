// Where uploaded photos live in R2, shared by Convex, the web app, and (through Convex) the processing workers.
// The browser uploads each photo to a staging key; a worker keeps valid photos according to the gallery's policy.
// Videos travel the same way as photos and are told apart by their names.

/** Photos the browser registers at a time, and the work one processing worker takes on. */
export const BATCH_PHOTOS = 50;
/** Larger photos are skipped when an upload is read. */
export const MAX_PHOTO_BYTES = 50 * 1024 ** 2;
/** Larger videos are skipped when an upload is read. */
export const MAX_VIDEO_BYTES = 500 * 1024 ** 2;
/**
 * Retries share this original URL expiry, so abandoned reservations can be released safely. An hour lets a 500 MB
 * video arrive over a connection of about 1.2 Mbps; at 15 minutes, slower phones could never finish one.
 */
export const STAGING_URL_LIFETIME_MS = 60 * 60 * 1000;
/** A photo's or video's name inside its upload: what the browser makes of its file name. */
export const PHOTO_NAME = /^[A-Za-z0-9._-]{1,200}\.(jpe?g|png|mp4|mov|m4v|webm)$/i;

/** Whether a file is a video, by its name. Gallery keys of videos and their copies keep the video's name. */
export const isVideo = (name: string) => /\.(mp4|mov|m4v|webm)$/i.test(name);

/** The largest file an upload takes under this name. */
export const maxBytes = (name: string) => (isVideo(name) ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES);

const TYPES: Record<string, string> = { png: "image/png", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
/** The content type a photo or video is uploaded with; its upload link is signed for it. */
export const mediaType = (name: string) => TYPES[name.slice(name.lastIndexOf(".") + 1).toLowerCase()] ?? "image/jpeg";

/**
 * The photos an upload registers next, from `first`: up to BATCH_PHOTOS photos, or a single video, which a worker
 * converts on its own.
 */
export function nextBatch<T extends { name: string }>(photos: T[], first: number): T[] {
  const batch: T[] = [];
  for (const photo of photos.slice(first, first + BATCH_PHOTOS)) {
    if (isVideo(photo.name) && batch.length) break;
    batch.push(photo);
    if (isVideo(photo.name)) break;
  }
  return batch;
}

/** A batch's upload area. Legacy batches use their upload ID instead of their batch ID. */
export const stagingKey = (collectionId: string, sourceId: string, name: string) => `uploads/${collectionId}/${sourceId}/${name}`;

/** A processed photo in its gallery. The upload's tag keeps two uploads' IMG_0001.jpg apart. */
export const photoKey = (collectionId: string, uploadId: string, name: string) => `${collectionId}/${uploadId.slice(-8)}-${name}`;

/** An original photo or video directly inside a gallery, excluding indexes and other stored files. */
export const isGalleryPhoto = (key: string) => /^[^/]+\/[^/]+\.(jpe?g|png|bmp|mp4|mov|m4v|webm)$/i.test(key);

/**
 * Where a gallery photo's smaller versions are stored, beside it: thumbs/ for grids, screen/ for full-screen views.
 * A video's thumbnail is its poster image, and its screen version is the MP4 that browsers play.
 */
export const resizedKey = (key: string, size: "thumbs" | "screen") => key.replace(/^([^/]+)\//, `$1/${size}/`);

/** Whether a media key holds a video's bytes: the video or its web copy, not its poster. */
export const isVideoFile = (key: string) => isVideo(key) && !/^[^/]+\/thumbs\//.test(key);

/** The original photo that a media key shows, including when the key points at its thumbnail or screen version. */
export function originalPhotoKey(key: string) {
  const original = key.replace(/^([^/]+)\/(?:thumbs|screen)\//, "$1/");
  return isGalleryPhoto(original) ? original : undefined;
}

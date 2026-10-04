// Where uploaded photos live in R2, shared by Convex, the web app, and (through Convex) the processing workers.
// The browser uploads each photo to a staging key; a worker moves photos with faces to their gallery key.

/** Photos the browser registers at a time, and the work one processing worker takes on. */
export const BATCH_PHOTOS = 50;
/** Larger photos are skipped when an upload is read. */
export const MAX_PHOTO_BYTES = 50 * 1024 ** 2;
/** A photo's name inside its upload: what the browser makes of its file name. */
export const PHOTO_NAME = /^[A-Za-z0-9._-]{1,200}\.(jpe?g|png)$/i;

/** The content type a photo is uploaded with; its upload link is signed for it. */
export const photoType = (name: string) => (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

/** Where the browser puts a photo before it's processed. Photos without faces never leave here. */
export const stagingKey = (collectionId: string, uploadId: string, name: string) => `uploads/${collectionId}/${uploadId}/${name}`;

/** A processed photo in its gallery. The upload's tag keeps two uploads' IMG_0001.jpg apart. */
export const photoKey = (collectionId: string, uploadId: string, name: string) => `${collectionId}/${uploadId.slice(-8)}-${name}`;

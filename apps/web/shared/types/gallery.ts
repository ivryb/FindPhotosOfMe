/** A gallery photo as the browser gets it: signed /media links that work for at least a day. */
export type GalleryPhoto = { key: string; thumb: string; full: string; download: string };

/** One page of a gallery; `next` is the cursor for the page after it, or null at the end. */
export type GalleryPage = { photos: GalleryPhoto[]; next: string | null };

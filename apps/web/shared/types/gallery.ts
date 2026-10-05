/** A gallery photo with stable same-origin links, authorized when the browser requests them. */
export type GalleryPhoto = { key: string; thumb: string; full: string; download: string };

/** Every photo the caller may browse, including just the selected previews for preview-only galleries. */
export type GalleryPhotos = { keys: string[] };

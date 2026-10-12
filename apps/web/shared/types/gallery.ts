/**
 * A gallery photo or video with stable same-origin links, authorized when the browser requests them. A video's thumb
 * is its poster and its screen version is what plays.
 */
export type GalleryPhoto = { key: string; video: boolean; thumb: string; screen: string; full: string; download: string };

/** Every photo the caller may browse, including just the selected previews for preview-only galleries. */
export type GalleryPhotos = { keys: string[] };

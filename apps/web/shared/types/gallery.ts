/** A gallery photo as the browser gets it: signed /media links that work for at least a day. */
export type GalleryPhoto = { key: string; thumb: string; full: string; download: string };

/**
 * Every photo a gallery's visitors may browse, in one response. A gallery that shows all its photos signs them
 * together, so it sends their keys and the two query strings that sign them (see mediaLinks); a gallery that
 * shows only previews signs each one.
 */
export type GalleryPhotos = { keys: string[]; view: string; download: string } | { photos: GalleryPhoto[] };

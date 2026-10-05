import type { GalleryPhoto } from "#shared/types/gallery";

/**
 * A photo's links through /media on this site. `view` and `download` are the query strings that sign them
 * (see server/utils/media.ts); a view signature also opens the photo's thumbnail.
 */
export function mediaLinks(key: string, view: string, download: string): GalleryPhoto {
  const slash = key.indexOf("/");
  return {
    key,
    thumb: mediaUrl(`${key.slice(0, slash)}/thumbs/${key.slice(slash + 1)}`, view),
    full: mediaUrl(key, view),
    download: mediaUrl(key, download),
  };
}

const mediaUrl = (key: string, query: string) => `/media/${key.split("/").map(encodeURIComponent).join("/")}?${query}`;

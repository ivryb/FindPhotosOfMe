import type { GalleryPhoto } from "#shared/types/gallery";

/** A photo's stable links through /media. Search results carry their request so its access can be checked. */
export function mediaLinks(key: string, { requestId }: { requestId?: string } = {}): GalleryPhoto {
  const query = new URLSearchParams(requestId ? { requestId } : {});
  const view = query.toString();
  query.set("download", "1");
  const slash = key.indexOf("/");
  return {
    key,
    thumb: mediaUrl(`${key.slice(0, slash)}/thumbs/${key.slice(slash + 1)}`, view),
    full: mediaUrl(key, view),
    download: mediaUrl(key, query.toString()),
  };
}

const mediaUrl = (key: string, query: string) => `/media/${key.split("/").map(encodeURIComponent).join("/")}${query ? `?${query}` : ""}`;

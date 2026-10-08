import { resizedKey } from "@FindPhotosOfMe/backend/convex/photoKeys";
import type { GalleryPhoto } from "#shared/types/gallery";

/** A photo's stable links through /media. Search results carry their request so its access can be checked. */
export function mediaLinks(key: string, { requestId, shareToken }: { requestId?: string; shareToken?: string } = {}): GalleryPhoto {
  const query = new URLSearchParams(requestId ? { requestId } : {});
  if (shareToken) query.set("shareToken", shareToken);
  const view = query.toString();
  query.set("download", "1");
  return {
    key,
    thumb: mediaUrl(resizedKey(key, "thumbs"), view),
    screen: mediaUrl(resizedKey(key, "screen"), view),
    full: mediaUrl(key, view),
    download: mediaUrl(key, query.toString()),
  };
}

const mediaUrl = (key: string, query: string) => `/media/${key.split("/").map(encodeURIComponent).join("/")}${query ? `?${query}` : ""}`;

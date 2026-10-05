import { afterAll, beforeAll, expect, test } from "bun:test";

import type { GalleryPhoto, GalleryPhotos } from "#shared/types/gallery";
import { mediaLinks } from "../shared/utils/media";
import { startApp } from "./app";

let app: Awaited<ReturnType<typeof startApp>>;

beforeAll(async () => {
  app = await startApp(3213);
}, 90000);

afterAll(() => app?.stop());

const list = async (gallery: string) => {
  const response = await fetch(`${app.origin}/api/galleries/${gallery}/photos`);
  return { status: response.status, body: response.ok ? (await response.json() as GalleryPhotos) : undefined };
};
const status = async (link: string) => (await fetch(app.origin + link)).status;

async function browsable() {
  const { body } = await list("test-collection");
  if (!body || !("keys" in body)) throw new Error("Expected a gallery signed as a whole");
  return body;
}

test("a browsable gallery returns every photo at once, without thumbnails or the face index", async () => {
  const { keys } = await browsable();
  expect(keys).toHaveLength(130);
  expect(new Set(keys).size).toBe(130);
  expect(keys[0]).toBe("test-collection/photo-001.jpg");
  expect(keys.some((key) => key.includes("thumbs/") || key.endsWith("embeddings.json"))).toBe(false);
});

test("each photo's links load its thumbnail and full photo through this site, cacheable", async () => {
  const { keys, view, download } = await browsable();
  const first = mediaLinks(keys[0]!, view, download);
  expect(first.thumb).toStartWith("/media/test-collection/thumbs/photo-001.jpg?");
  const [thumb, full] = await Promise.all([fetch(app.origin + first.thumb), fetch(app.origin + first.full)]);
  expect(thumb.status).toBe(200);
  expect(full.status).toBe(200);
  expect(full.headers.get("content-type")).toContain("image/jpeg");
  expect(full.headers.get("cache-control")).toContain("public");
  expect(full.headers.get("content-disposition")).toBeNull();
});

test("a gallery's links open its own photos and nothing else", async () => {
  const { keys, view, download } = await browsable();
  expect(await status(mediaLinks(keys[41]!, view, download).thumb)).toBe(200);
  // The face index, another gallery's photo, a changed signature, and a view link turned into a download
  const first = mediaLinks(keys[0]!, view, download);
  for (const link of [`/media/test-collection/embeddings.json?${view}`, `/media/other-collection/photo-001.jpg?${view}`, first.full.replace(/s=[^&]+/, "s=forged"), `${first.full}&download=1`]) {
    expect(await status(link)).toBe(403);
  }
});

test("a gallery that shows only previews returns just those, each signed on its own", async () => {
  const { body } = await list("preview-collection");
  const photos: GalleryPhoto[] = body && "photos" in body ? body.photos : [];
  expect(photos.map((photo) => photo.key)).toEqual(["test-collection/photo-001.jpg", "test-collection/photo-002.jpg"]);
  const [first] = photos;
  expect(await status(first!.thumb)).toBe(200);
  // A preview's signature opens neither a photo the gallery hides nor the whole gallery
  const signature = new URL(first!.full, app.origin).search;
  for (const link of [`/media/test-collection/photo-003.jpg${signature}`, `${first!.full}&g=1`]) {
    expect(await status(link)).toBe(403);
  }
});

test("a gallery that isn't online has no photos to list", async () => {
  expect((await list("offline-collection")).status).toBe(404);
});

test("owners can list photos of a private gallery while anonymous visitors cannot", async () => {
  const { ownerJwt } = await import("./backend");
  expect((await list("private-collection")).status).toBe(404);
  const response = await fetch(`${app.origin}/api/galleries/private-collection/photos`, {
    headers: { authorization: `Bearer ${ownerJwt}` },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

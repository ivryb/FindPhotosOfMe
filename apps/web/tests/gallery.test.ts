import { afterAll, beforeAll, expect, test } from "bun:test";

import type { GalleryPage } from "#shared/types/gallery";
import { startApp } from "./app";

let app: Awaited<ReturnType<typeof startApp>>;

beforeAll(async () => {
  app = await startApp(3213);
}, 90000);

afterAll(() => app?.stop());

const page = (gallery: string, after?: string) =>
  fetch(`${app.origin}/api/galleries/${gallery}/photos${after ? `?after=${after}` : ""}`);

test("a browsable gallery pages through every photo, skipping thumbnails and the face index", async () => {
  const keys: string[] = [];
  let next: string | null | undefined;
  do {
    const response = await page("test-collection", next ?? undefined);
    expect(response.status).toBe(200);
    const body: GalleryPage = await response.json();
    keys.push(...body.photos.map((photo) => photo.key));
    next = body.next;
  } while (next);

  expect(keys).toHaveLength(130);
  expect(new Set(keys).size).toBe(130);
  expect(keys[0]).toBe("test-collection/photo-001.jpg");
  expect(keys.some((key) => key.includes("thumbs/") || key.endsWith("embeddings.json"))).toBe(false);
});

test("each photo's links load its thumbnail and full photo through this site, cacheable", async () => {
  const { photos }: GalleryPage = await (await page("test-collection")).json();
  const [first] = photos;
  expect(first!.thumb).toStartWith("/media/test-collection/thumbs/photo-001.jpg?");
  const [thumb, full] = await Promise.all([fetch(app.origin + first!.thumb), fetch(app.origin + first!.full)]);
  expect(thumb.status).toBe(200);
  expect(full.status).toBe(200);
  expect(full.headers.get("content-type")).toContain("image/jpeg");
  expect(full.headers.get("cache-control")).toContain("public");
  expect(full.headers.get("content-disposition")).toBeNull();
});

test("a photo link works only for the photo and use it was signed for", async () => {
  const { photos }: GalleryPage = await (await page("test-collection")).json();
  const [first, second] = photos;
  const signature = new URL(first!.full, app.origin).search;
  // Another photo with this photo's signature, a changed signature, and a view link turned into a download
  for (const link of [`/media/${second!.key}${signature}`, first!.full.replace(/s=[^&]+/, "s=forged"), `${first!.full}&download=1`]) {
    expect((await fetch(app.origin + link)).status).toBe(403);
  }
});

test("a gallery that shows only previews returns just those", async () => {
  const body: GalleryPage = await (await page("preview-collection")).json();
  expect(body.photos.map((photo) => photo.key)).toEqual(["test-collection/photo-001.jpg", "test-collection/photo-002.jpg"]);
  expect(body.next).toBeNull();
});

test("a gallery that isn't online has no photos to list", async () => {
  expect((await page("offline-collection")).status).toBe(404);
});

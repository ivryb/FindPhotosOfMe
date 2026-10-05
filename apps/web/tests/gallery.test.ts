import { afterAll, beforeAll, expect, test } from "bun:test";

import type { GalleryPhotos } from "#shared/types/gallery";
import { mediaLinks } from "../shared/utils/media";
import { startApp } from "./app";
import { ownerJwt, sessionCookie } from "./backend";

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

test("public photos and thumbnails load from stable URLs without signatures", async () => {
  for (const link of ["/media/test-collection/photo-001.jpg", "/media/test-collection/thumbs/photo-001.jpg", "/media/test-collection/photo-001.jpg?d=1&s=expired&g=1"]) {
    const response = await fetch(app.origin + link);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
  }
});

test("gallery listings return photo keys without expiring access tokens", async () => {
  const { body } = await list("test-collection");
  expect(body && Object.keys(body)).toEqual(["keys"]);
});

test("private photos load with the owner's session and reject anonymous or forged access", async () => {
  const url = `${app.origin}/media/private-collection/photo-001.jpg`;
  expect((await fetch(url)).status).toBe(403);
  expect((await fetch(`${url}?s=forged&g=1`)).status).toBe(403);
  expect((await fetch(url, { headers: { cookie: sessionCookie } })).status).toBe(200);
  expect((await fetch(url, { headers: { authorization: `Bearer ${ownerJwt}` } })).status).toBe(200);
});

test("browsers ask the Worker again so changing access also closes previously viewed photos", async () => {
  const response = await fetch(`${app.origin}/media/test-collection/photo-001.jpg`);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-cache");
  const etag = response.headers.get("etag");
  expect(etag).not.toBeNull();
  const revalidated = await fetch(`${app.origin}/media/test-collection/photo-001.jpg`, { headers: { "if-none-match": etag! } });
  expect(revalidated.status).toBe(304);
  expect(await revalidated.text()).toBe("");
});

async function browsable() {
  const { body } = await list("test-collection");
  if (!body) throw new Error("Expected a browsable gallery");
  return body;
}

test("a browsable gallery returns every photo at once, without thumbnails or the face index", async () => {
  const { keys } = await browsable();
  expect(keys).toHaveLength(130);
  expect(new Set(keys).size).toBe(130);
  expect(keys[0]).toBe("test-collection/photo-001.jpg");
  expect(keys.some((key) => key.includes("thumbs/") || key.endsWith("embeddings.json"))).toBe(false);
});

test("each photo's links load its thumbnail and full photo through this site", async () => {
  const { keys } = await browsable();
  const first = mediaLinks(keys[0]!);
  expect(first.thumb).toBe("/media/test-collection/thumbs/photo-001.jpg");
  const [thumb, full] = await Promise.all([fetch(app.origin + first.thumb), fetch(app.origin + first.full)]);
  expect(thumb.status).toBe(200);
  expect(full.status).toBe(200);
  expect(full.headers.get("content-type")).toContain("image/jpeg");
  expect(full.headers.get("cache-control")).toBe("private, no-cache");
  expect(full.headers.get("content-disposition")).toBeNull();
});

test("media routes expose only photos of accessible galleries", async () => {
  expect(await status("/media/test-collection/thumbs/photo-042.jpg")).toBe(200);
  for (const link of ["/media/test-collection/embeddings.json", "/media/test-collection/faces/index.npz", "/media/other-collection/photo-001.jpg"]) {
    expect(await status(link)).toBe(403);
  }
});

test("a gallery that shows only previews returns and serves just those photos", async () => {
  const { body } = await list("preview-collection");
  expect(body?.keys).toEqual(["preview-collection/photo-001.jpg", "preview-collection/photo-002.jpg"]);
  expect(await status("/media/preview-collection/thumbs/photo-001.jpg")).toBe(200);
  for (const link of ["/media/preview-collection/photo-003.jpg", "/media/preview-collection/photo-003.jpg?g=1&s=forged"]) {
    expect(await status(link)).toBe(403);
  }
});

test("a gallery that isn't online has no photos to list", async () => {
  expect((await list("offline-collection")).status).toBe(404);
});

test("owners can list photos of a private gallery while anonymous visitors cannot", async () => {
  expect((await list("private-collection")).status).toBe(404);
  const response = await fetch(`${app.origin}/api/galleries/private-collection/photos`, {
    headers: { authorization: `Bearer ${ownerJwt}` },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

test("unpublishing closes previously issued public photo URLs while owners retain access", async () => {
  const url = `${app.origin}/media/test-collection/photo-001.jpg`;
  expect((await fetch(url)).status).toBe(200);
  const publish = (published: boolean) => fetch(`${app.backendOrigin}/api/mutation`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${ownerJwt}` },
    body: JSON.stringify({ path: "collections:setPublished", args: [{ id: "test-collection", published }], format: "json" }),
  });
  try {
    expect((await publish(false)).status).toBe(200);
    expect((await fetch(url)).status).toBe(403);
    expect((await fetch(`${url}?d=1&s=old&g=1`)).status).toBe(403);
    expect((await fetch(url, { headers: { cookie: sessionCookie } })).status).toBe(200);
  } finally {
    await publish(true);
  }
});

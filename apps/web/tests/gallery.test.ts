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

test("browsers keep a photo for ten minutes, then ask the Worker again so changed access still applies", async () => {
  const response = await fetch(`${app.origin}/media/test-collection/photo-001.jpg`);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, max-age=600");
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
  expect(full.headers.get("cache-control")).toBe("private, max-age=600");
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

test("secret galleries render anonymously with crawler and referrer protection, including when empty", async () => {
  const { galleryToken, emptyGalleryToken } = await import("./backend");
  for (const token of [galleryToken, emptyGalleryToken]) {
    const response = await fetch(`${app.origin}/gallery/${token}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const html = await response.text();
    expect(html).toContain("Upload your photos");
    expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
  }
  expect((await fetch(`${app.origin}/gallery/invalid-token`)).status).toBe(404);
  expect(await (await fetch(`${app.origin}/robots.txt`)).text()).toContain("Disallow: /gallery/");
});

test("gallery listing and every media URL forward the secret credential", async () => {
  const { galleryToken } = await import("./backend");
  const endpoint = `${app.origin}/api/galleries/secret-collection/photos`;
  expect((await fetch(endpoint)).status).toBe(404);
  expect((await fetch(`${endpoint}?shareToken=wrong`)).status).toBe(404);
  const response = await fetch(`${endpoint}?shareToken=${galleryToken}`);
  expect(response.status).toBe(200);
  const { keys } = await response.json() as GalleryPhotos;
  expect(keys.length).toBe(130);
  const photo = mediaLinks(keys[0]!, { shareToken: galleryToken });
  for (const link of [photo.full, photo.thumb, photo.download]) {
    expect(await status(link)).toBe(200);
    expect(await status(link.replace(galleryToken, "wrong"))).toBe(403);
  }
});


test("selfie searches forward the gallery link credential", async () => {
  const { galleryToken } = await import("./backend");
  const search = (token?: string) => {
    const body = new FormData();
    body.append("collection_id", "secret-collection");
    body.append("reference_photo", new Blob(["fixture-image"], { type: "image/jpeg" }), "selfie.jpg");
    if (token) body.append("share_token", token);
    return fetch(`${app.origin}/api/search`, { method: "POST", body });
  };
  expect((await search()).status).toBe(409);
  expect((await search("wrong")).status).toBe(409);
  expect((await search(galleryToken)).status).toBe(200);
});

test("anonymous upload completion checks the contributor and exact stored sizes before charging", async () => {
  const { galleryToken } = await import("./backend");
  const access = { shareToken: galleryToken, contributorKey: "a".repeat(32) };
  const started = await fetch(`${app.backendOrigin}/api/mutation`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "uploads:start", args: [{ collectionId: "secret-collection", name: "guest.jpg", size: 5, photos: 1, access }], format: "json" }),
  });
  const { value: { uploadId } } = await started.json();
  const post = (path: string, body: object) => fetch(`${app.origin}/api/uploads/${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const signed = await post("presign", { uploadId, first: 0, photos: [{ name: "guest.jpg", size: 5 }], access });
  expect(signed.status).toBe(200);
  const { batchId, urls } = await signed.json() as { batchId: string; urls: string[] };
  const finish = (contributor = access) => post("complete", { batchId, access: contributor });
  expect((await finish({ ...access, contributorKey: "b".repeat(32) })).status).toBe(409);
  // The fake bucket permits an incorrectly sized PUT so the real completion route must catch it.
  await fetch(urls[0]!, { method: "PUT", body: "bad", headers: { "content-type": "image/jpeg" } });
  expect((await finish()).status).toBe(409);
  let uploaded = await (await fetch(`${app.backendOrigin}/__fixture/uploads`)).json();
  expect(uploaded.batches.filter((item: { uploadId: string }) => item.uploadId === uploadId)).toHaveLength(0);
  await fetch(urls[0]!, { method: "PUT", body: "photo", headers: { "content-type": "image/jpeg" } });
  expect((await finish()).status).toBe(200);
  uploaded = await (await fetch(`${app.backendOrigin}/__fixture/uploads`)).json();
  expect(uploaded.batches.filter((item: { uploadId: string }) => item.uploadId === uploadId)).toHaveLength(1);
});

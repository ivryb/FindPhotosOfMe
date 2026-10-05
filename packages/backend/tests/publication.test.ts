import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { QueryCtx } from "../convex/_generated/server";
import schema from "../convex/schema";

// Exercise real mutations with distinct caller identities; only the auth provider is replaced.
vi.mock("../convex/auth", async (original) => {
  const user = async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? { _id: identity.subject, email: `${identity.subject}@example.com` } : null;
  };
  return { ...(await original<object>()), authComponent: { getAuthUser: user, safeGetAuthUser: user } };
});
const modules = import.meta.glob("../convex/**/*.ts");
const serviceToken = "publication-test";
beforeEach(() => vi.stubEnv("SERVICE_TOKEN", serviceToken));

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner" });
  const stranger = t.withIdentity({ subject: "stranger" });
  const id = await owner.mutation(api.collections.create, { title: "My private photos", description: "" });
  const ready = () => t.run((ctx) => ctx.db.patch(id, { imagesCount: 10, status: "complete" }));
  const address = (subdomain = "my-photos") => owner.mutation(api.collections.update, {
    id, subdomain, title: "My private photos", description: "",
  });
  const publish = (published: boolean) => owner.mutation(api.collections.setPublished, { id, published });
  return { t, owner, stranger, id, ready, address, publish };
}

test("a gallery needs no address and stays private after photos finish processing", async () => {
  const { t, owner, stranger, id, ready } = await setup();
  await ready();
  expect(await owner.query(api.collections.get, { id })).toMatchObject({ title: "My private photos", published: false });
  expect((await owner.query(api.collections.get, { id })).subdomain).toBeUndefined();
  expect(await t.query(api.collections.getPublic, { id })).toBeNull();
  await expect(stranger.query(api.collections.get, { id })).rejects.toThrow("Not authorized");
  await expect(t.mutation(api.searchRequests.create, { collectionId: id })).rejects.toThrow("private");
  await expect(stranger.mutation(api.searchRequests.create, { collectionId: id })).rejects.toThrow("private");
});

test("owners can search privately and only they can read and download their results, even after publication", async () => {
  const { t, owner, stranger, id, ready, address, publish } = await setup();
  await ready();
  const requestId = await owner.mutation(api.searchRequests.create, { collectionId: id });
  const keys = [`${id}/me.jpg`];
  await t.mutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "complete", imagesFound: keys });
  expect(await owner.query(api.searchRequests.get, { id: requestId })).toMatchObject({ status: "complete", requesterId: "owner" });
  expect(await owner.query(api.searchRequests.authorizeImages, { id: requestId, keys })).toBe(true);
  await address();
  await publish(true);
  for (const caller of [t, stranger]) {
    expect(await caller.query(api.searchRequests.get, { id: requestId })).toBeNull();
    await expect(caller.query(api.searchRequests.authorizeImages, { id: requestId, keys })).rejects.toThrow("Not authorized");
  }
  expect(await owner.query(api.searchRequests.authorizeImages, { id: requestId, keys: [`${id}/someone-else.jpg`] })).toBe(false);
});

test("publishing requires an address and only the owner can publish or unpublish", async () => {
  const { t, stranger, id, ready, address, publish } = await setup();
  await expect(publish(true)).rejects.toThrow("page address");
  await expect(address("-a")).rejects.toThrow("3–63");
  await address();
  await ready();
  expect(await t.query(api.collections.getPublicBySubdomain, { subdomain: "my-photos" })).toBeNull();
  await expect(stranger.mutation(api.collections.setPublished, { id, published: true })).rejects.toThrow("Not authorized");
  await publish(true);
  expect(await t.query(api.collections.getPublicBySubdomain, { subdomain: "my-photos" })).toMatchObject({ _id: id });
  await expect(address("")).rejects.toThrow("page address");
  await expect(stranger.mutation(api.collections.setPublished, { id, published: false })).rejects.toThrow("Not authorized");
  await publish(false);
  expect(await t.query(api.collections.getPublic, { id })).toBeNull();
});

test("unpublishing closes attendee searches and previously shared results and downloads", async () => {
  const { t, id, ready, address, publish } = await setup();
  await ready(); await address(); await publish(true);
  const requestId = await t.mutation(api.searchRequests.create, { collectionId: id });
  const keys = [`${id}/me.jpg`];
  await t.mutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "complete", imagesFound: keys });
  expect(await t.query(api.searchRequests.authorizeImages, { id: requestId, keys })).toBe(true);
  await publish(false);
  expect(await t.query(api.searchRequests.get, { id: requestId })).toBeNull();
  await expect(t.query(api.searchRequests.authorizeImages, { id: requestId, keys })).rejects.toThrow("Not authorized");
  await expect(t.mutation(api.searchRequests.create, { collectionId: id })).rejects.toThrow("private");
  await expect(t.mutation(api.searchRequests.createForService, {
    collectionId: id, telegramChatId: "chat", fileId: "file", messageId: 1, serviceToken,
  })).rejects.toThrow("private");
});

test("existing galleries keep working until their owner explicitly unpublishes them", async () => {
  const { t, owner } = await setup();
  const id = await t.run((ctx) => ctx.db.insert("collections", {
    title: "Existing gallery", description: "", subdomain: "existing", createdBy: "owner", imagesCount: 10, status: "complete",
  }));
  expect(await t.query(api.collections.getPublicBySubdomain, { subdomain: "existing" })).toMatchObject({ _id: id });
  expect(await t.mutation(api.searchRequests.create, { collectionId: id })).toBeTruthy();
  await owner.mutation(api.collections.setPublished, { id, published: false });
  expect(await t.query(api.collections.getPublic, { id })).toBeNull();
});

test("addresses stay unique and expired galleries cannot be published", async () => {
  const { t, owner, id, address, publish } = await setup();
  await address();
  const other = await owner.mutation(api.collections.create, { title: "Other", description: "" });
  await expect(owner.mutation(api.collections.update, { id: other, title: "Other", description: "", subdomain: "my-photos" })).rejects.toThrow("already in use");
  await t.run((ctx) => ctx.db.patch(id, { expiresAt: 1 }));
  await expect(publish(true)).rejects.toThrow("offline");
});

// Older galleries could have single-character addresses; editing them must not break their shared links.
test("existing short addresses remain editable", async () => {
  const { t, owner } = await setup();
  const id = await t.run((ctx) => ctx.db.insert("collections", {
    title: "Existing", description: "", subdomain: "a", createdBy: "owner", imagesCount: 10, status: "complete",
  }));
  await owner.mutation(api.collections.update, { id, title: "Renamed", description: "New description", subdomain: "a" });
  expect(await t.query(api.collections.getPublicBySubdomain, { subdomain: "a" })).toMatchObject({ title: "Renamed", description: "New description" });
});

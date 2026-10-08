import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { QueryCtx } from "../convex/_generated/server";
import schema from "../convex/schema";
import { PRICES } from "../convex/pricing";

vi.mock("../convex/auth", async (original) => {
  const user = async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? { _id: identity.subject, email: `${identity.subject}@example.com` } : null;
  };
  return { ...(await original<object>()), authComponent: { getAuthUser: user, safeGetAuthUser: user } };
});
const modules = import.meta.glob("../convex/**/*.ts");
const serviceToken = "crowdsourcing-test";
beforeEach(() => { vi.stubEnv("SERVICE_TOKEN", serviceToken); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner" });
  const id = await owner.mutation(api.collections.create, { title: "Our weekend", description: "" });
  const gallery = await owner.query(api.collections.get, { id });
  const shareToken = gallery.shareToken!;
  const access = { shareToken, contributorKey: "a".repeat(32) };
  const other = { shareToken, contributorKey: "b".repeat(32) };
  const settings = (crowdsource: boolean) => owner.mutation(api.collections.update, { id, title: "Our weekend", description: "", crowdsource });
  await settings(true);
  await owner.mutation(api.collections.setPublished, { id, published: true });
  const start = (guest = access) => t.mutation(api.uploads.start, { collectionId: id, name: "photos", size: 10, photos: 2, access: guest });
  return { t, owner, id, shareToken, access, other, settings, start };
}

test("an empty gallery publishes by secret link without a subdomain or public ID bypass", async () => {
  const { t, id, shareToken } = await setup();
  expect(await t.query(api.collections.getPublicByToken, { shareToken })).toMatchObject({ _id: id, imagesCount: 0, crowdsource: true, showAllPhotos: true });
  expect(await t.query(api.collections.getPublic, { id })).toBeNull();
  expect(await t.query(api.collections.getPublic, { id, shareToken: "wrong" })).toBeNull();
  expect(await t.query(api.collections.getPublicByToken, { shareToken: "wrong" })).toBeNull();
});

test("secret gallery metadata, media and search enforce link possession; unpublishing closes them", async () => {
  const { t, owner, id, shareToken } = await setup();
  await t.run((ctx) => ctx.db.patch(id, { imagesCount: 2, subdomain: "old-address", showAllPhotos: false }));
  expect(await t.query(api.collections.getPublicBySubdomain, { subdomain: "old-address" })).toBeNull();
  for (const key of [`${id}/photo.jpg`, `${id}/thumbs/photo.jpg`]) {
    expect(await t.query(api.collections.canReadPhoto, { key })).toBe(false);
    expect(await t.query(api.collections.canReadPhoto, { key, shareToken: "wrong" })).toBe(false);
    expect(await t.query(api.collections.canReadPhoto, { key, shareToken })).toBe(true);
    expect(await owner.query(api.collections.canReadPhoto, { key })).toBe(true);
  }
  expect(await t.query(api.collections.canReadPhoto, { key: `${id}/faces/index.npz`, shareToken })).toBe(false);
  await expect(t.mutation(api.searchRequests.create, { collectionId: id })).rejects.toThrow("private");
  const requestId = await t.mutation(api.searchRequests.create, { collectionId: id, shareToken });
  await t.mutation(api.searchRequests.updateForService, { id: requestId, serviceToken, status: "complete", imagesFound: [`${id}/photo.jpg`] });
  expect(await t.query(api.collections.canReadPhoto, { key: `${id}/photo.jpg`, requestId })).toBe(true);
  await owner.mutation(api.collections.setPublished, { id, published: false });
  expect(await t.query(api.collections.canReadPhoto, { key: `${id}/photo.jpg`, shareToken })).toBe(false);
  expect(await t.query(api.collections.canReadPhoto, { key: `${id}/photo.jpg`, requestId })).toBe(false);
});

test("guests resume only their own uploads and cannot sign, queue or list another guest's photos", async () => {
  const { t, id, access, other, start } = await setup();
  const first = await start();
  expect(await start()).toEqual(first);
  const second = await start(other);
  expect(second.uploadId).not.toBe(first.uploadId);
  const args = { uploadId: first.uploadId, first: 0, photos: [{ name: "a.jpg", size: 10 }], access: other };
  await expect(t.mutation(api.uploads.prepareBatch, args)).rejects.toThrow("Not authorized");
  expect((await t.query(api.uploads.list, { collectionId: id, access: other })).map((item) => item._id)).toEqual([second.uploadId]);
  const { batchId } = await t.mutation(api.uploads.prepareBatch, { ...args, access });
  await expect(t.query(api.uploads.getStagingBatch, { id: batchId, access: other })).rejects.toThrow("Not authorized");
  await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  await expect(t.mutation(api.uploads.prepareBatch, { ...args, first: 1, access })).rejects.toThrow("already submitted");
});

test("closing guest uploads blocks new and in-progress contributions while retaining browsing", async () => {
  const { t, id, access, settings, start, shareToken } = await setup();
  const { uploadId } = await start();
  const args = { uploadId, first: 0, photos: [{ name: "a.jpg", size: 10 }], access };
  const { batchId } = await t.mutation(api.uploads.prepareBatch, args);
  await settings(false);
  await expect(start()).rejects.toThrow("turned off");
  await expect(t.mutation(api.uploads.prepareBatch, args)).rejects.toThrow("turned off");
  await expect(t.query(api.uploads.getStagingBatch, { id: batchId, access })).rejects.toThrow("turned off");
  await expect(t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken })).rejects.toThrow("turned off");
  expect(await t.query(api.collections.getPublic, { id, shareToken })).not.toBeNull();
});

test("wrong links and other galleries cannot reuse an upload authorization", async () => {
  const { t, owner, id, access, start } = await setup();
  await expect(start({ ...access, shareToken: "wrong" })).rejects.toThrow("private");
  const { uploadId } = await start();
  const otherId = await owner.mutation(api.collections.create, { title: "Other", description: "" });
  const otherGallery = await owner.query(api.collections.get, { id: otherId });
  await expect(t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "a.jpg", size: 10 }], access: { ...access, shareToken: otherGallery.shareToken } })).rejects.toThrow("private");
  await t.run((ctx) => ctx.db.patch(id, { expiresAt: 1 }));
  await expect(start()).rejects.toThrow("offline");
});

test("guest batches spend the owner's balance once and keep all photos even if contributions close", async () => {
  const { t, id, access, start, settings } = await setup();
  const { uploadId } = await start();
  const credit = () => t.run(async (ctx) => (await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", "owner")).unique())!.credit);
  const before = await credit();
  const names = ["scenery.jpg", "people.jpg"];
  const args = { uploadId, first: 0, photos: names.map((name) => ({ name, size: 10 })), access };
  const { batchId } = await t.mutation(api.uploads.prepareBatch, args);
  await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  await t.mutation(api.uploads.commitBatchForService, { id: batchId, serviceToken });
  expect(await credit()).toBe(before - 2 * PRICES.photo);
  const batch = await t.run((ctx) => ctx.db.query("uploadBatches").first());
  await settings(false);
  expect(await t.query(api.uploads.getBatchForService, { id: batch!._id, serviceToken })).toMatchObject({ keepAllPhotos: true, moderate: true });
  await t.mutation(api.uploads.completeBatchForService, { id: batch!._id, saved: names, savedBytes: 100, serviceToken });
  expect((await t.run((ctx) => ctx.db.get(id)))?.imagesCount).toBe(2);
  expect(await credit()).toBe(before - 2 * PRICES.photo);
});

test("guest uploads stop atomically when the owner's balance cannot cover the batch", async () => {
  const { t, access, start } = await setup();
  const { uploadId } = await start();
  await t.run(async (ctx) => {
    const balance = await ctx.db.query("balances").withIndex("by_user", (q) => q.eq("userId", "owner")).unique();
    await ctx.db.patch(balance!._id, { credit: 0 });
  });
  await expect(t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "a.jpg", size: 10 }], access })).rejects.toThrow("owner’s balance");
  expect((await t.run((ctx) => ctx.db.get(uploadId)))?.sent).toBe(0);
  expect(await t.run((ctx) => ctx.db.query("uploadBatches").collect())).toEqual([]);
});

test("Telegram requires the invite and explicit upload mode; search selfies cannot be contributed", async () => {
  const { t, owner, id, shareToken, settings } = await setup();
  const chat = { collectionId: id, chatId: "123", serviceToken };
  const upload = { ...chat, fileId: "file", filename: "a.jpg", mediaGroupId: "album-1" };
  await expect(t.mutation(api.telegramAccess.enter, chat)).rejects.toThrow("invite");
  await expect(t.mutation(api.telegramAccess.enter, { ...chat, inviteToken: "wrong" })).rejects.toThrow("invite");
  await t.mutation(api.telegramAccess.enter, { ...chat, inviteToken: shareToken });
  await expect(t.mutation(api.telegramAccess.queueUpload, upload)).rejects.toThrow("Choose Upload");
  await t.mutation(api.telegramAccess.enter, { ...chat, mode: "upload" });
  await t.mutation(api.telegramAccess.queueUpload, upload);
  await t.run((ctx) => ctx.db.patch(id, { imagesCount: 1 }));
  const search = { collectionId: id, telegramChatId: "123", fileId: "selfie", messageId: 2, serviceToken };
  await expect(t.mutation(api.searchRequests.createForService, search)).rejects.toThrow("Choose Find");
  await t.mutation(api.telegramAccess.enter, { ...chat, mode: "search" });
  expect(await t.mutation(api.searchRequests.createForService, search)).toBeTruthy();
  await settings(false);
  await expect(t.mutation(api.telegramAccess.enter, { ...chat, mode: "upload" })).rejects.toThrow("turned off");
  await owner.mutation(api.collections.setPublished, { id, published: false });
  await expect(t.query(api.telegramAccess.getForService, chat)).rejects.toThrow("private");
});

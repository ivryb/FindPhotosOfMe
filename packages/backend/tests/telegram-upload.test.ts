// @vitest-environment node
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const external = vi.hoisted(() => ({
  getFile: vi.fn(), sendMessage: vi.fn(), store: vi.fn(),
}));
vi.mock("grammy", () => ({ Api: class {
  getFile = external.getFile;
  sendMessage = external.sendMessage;
} }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = external.store; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class {},
  DeleteObjectsCommand: class { constructor(public input: unknown) {} },
}));
const modules = import.meta.glob("../convex/**/*.ts");
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  for (const name of ["PYTHON_API_URL", "SERVICE_TOKEN", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]) vi.stubEnv(name, "fixture");
  external.getFile.mockResolvedValue({ file_path: "photos/photo.jpg", file_size: 5 });
  external.sendMessage.mockResolvedValue({}); external.store.mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4, 5]))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function setup() {
  const t = convexTest(schema, modules);
  const collectionId = await t.run(async (ctx) => {
    await ctx.db.insert("balances", { userId: "owner", credit: 100, paid: true });
    return ctx.db.insert("collections", {
      title: "Weekend", description: "", imagesCount: 0, status: "not_started", createdBy: "owner",
      sharing: "link", shareToken: "invite", published: true, crowdsource: true, telegramBotToken: "fixture-token",
    });
  });
  await t.mutation(api.telegramAccess.enter, { collectionId, chatId: "123", serviceToken: "fixture", inviteToken: "invite", mode: "upload" });
  const args = { collectionId, chatId: "123", fileId: "file", filename: "Telegram-1.jpg", notify: true, album: false };
  return { t, collectionId, args };
}

test("a Telegram photo reaches R2 staging and the existing paid processing queue", async () => {
  const { t, collectionId, args } = await setup();
  external.store.mockImplementationOnce(async () => {
    expect(await t.run((ctx) => ctx.db.query("uploadBatches").first())).toMatchObject({ status: "staging", names: ["photo.jpg"] });
    expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 5 });
    expect(await t.run((ctx) => ctx.db.query("balanceEntries").collect())).toEqual([]);
    return {};
  });
  await t.action(internal.telegram.uploadAndReply, args);
  const upload = await t.run((ctx) => ctx.db.query("uploads").first());
  const batch = await t.run((ctx) => ctx.db.query("uploadBatches").first());
  expect(upload).toMatchObject({ collectionId, sent: 1, photos: 1 });
  expect(external.store).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({
    Key: `uploads/${collectionId}/${batch!._id}/photo.jpg`, ContentType: "image/jpeg", Body: new Uint8Array([1, 2, 3, 4, 5]),
  }) }));
  expect(batch).toMatchObject({ names: ["photo.jpg"], keepAllPhotos: true, status: "pending" });
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 95 });
  expect(external.sendMessage).toHaveBeenCalledWith("123", expect.stringContaining("Photo uploaded"));
});

test("a failed Telegram upload retries against the same reserved batch and charges only after storage succeeds", async () => {
  const { t, collectionId, args } = await setup();
  external.store.mockRejectedValueOnce(new Error("Storage unavailable"));
  await t.action(internal.telegram.uploadAndReply, args);
  const reserved = await t.run((ctx) => ctx.db.query("uploadBatches").first());
  expect(reserved).toMatchObject({ status: "staging", names: ["photo.jpg"] });
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 5 });
  expect(await t.run((ctx) => ctx.db.query("balanceEntries").collect())).toEqual([]);
  expect(external.sendMessage).toHaveBeenCalledWith("123", expect.stringContaining("couldn’t be uploaded"));

  await t.action(internal.telegram.uploadAndReply, args);
  const batches = await t.run((ctx) => ctx.db.query("uploadBatches").collect());
  expect(batches).toHaveLength(1);
  expect(batches[0]).toMatchObject({ _id: reserved?._id, status: "pending" });
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 95, reserved: 0 });
  expect(await t.run((ctx) => ctx.db.query("balanceEntries").collect())).toMatchObject([{ reason: "photos", amount: -5 }]);
  expect(external.store).toHaveBeenNthCalledWith(2, expect.objectContaining({ input: expect.objectContaining({
    Key: `uploads/${collectionId}/${reserved?._id}/photo.jpg`,
  }) }));
});

test("an abandoned upload releases its hold only after expired upload links can no longer recreate its deleted photos", async () => {
  const { t, collectionId } = await setup();
  const access = { shareToken: "invite", contributorKey: "0123456789abcdef0123456789abcdef" };
  const { uploadId } = await t.mutation(api.uploads.start, { collectionId, name: "photos", size: 5, photos: 1, access });
  const batch = await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "photo.jpg", size: 5 }], access });

  vi.setSystemTime(batch.expiresAt + 59_999);
  await t.action(internal.stagingStorage.cleanup, { id: batch.batchId });
  expect(external.store).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 5 });

  vi.setSystemTime(batch.expiresAt + 60_000);
  external.store.mockImplementationOnce(async () => {
    expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 5 });
    return {};
  });
  await t.action(internal.stagingStorage.cleanup, { id: batch.batchId });
  expect(external.store).toHaveBeenCalledWith(expect.objectContaining({ input: {
    Bucket: "fixture", Delete: { Objects: [{ Key: `uploads/${collectionId}/${batch.batchId}/photo.jpg` }], Quiet: true },
  } }));
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 0 });
  expect(await t.run((ctx) => ctx.db.query("balanceEntries").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.get(batch.batchId))).toBeNull();

  const retry = await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "photo.jpg", size: 5 }], access });
  expect(retry.batchId).not.toBe(batch.batchId);
  external.store.mockClear();
  await t.action(internal.stagingStorage.cleanup, { id: batch.batchId });
  expect(external.store).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 5 });
});

test("a per-photo storage deletion error keeps the credit reserved until cleanup succeeds", async () => {
  const { t, collectionId } = await setup();
  const access = { shareToken: "invite", contributorKey: "0123456789abcdef0123456789abcdef" };
  const { uploadId } = await t.mutation(api.uploads.start, { collectionId, name: "photos", size: 5, photos: 1, access });
  const batch = await t.mutation(api.uploads.prepareBatch, { uploadId, first: 0, photos: [{ name: "photo.jpg", size: 5 }], access });
  vi.setSystemTime(batch.expiresAt + 60_000);
  external.store.mockResolvedValueOnce({ Errors: [{ Code: "AccessDenied", Key: "photo.jpg" }] });
  await expect(t.action(internal.stagingStorage.cleanup, { id: batch.batchId })).rejects.toThrow("cleanup failed");
  expect(await t.run((ctx) => ctx.db.get(batch.batchId))).toMatchObject({ status: "staging" });
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 5 });

  await t.action(internal.stagingStorage.cleanup, { id: batch.batchId });
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100, reserved: 0 });
  expect(await t.run((ctx) => ctx.db.get(batch.batchId))).toBeNull();
});

test("a rejected photo is refunded only after its upload URL expires and storage cleanup succeeds", async () => {
  const { t, collectionId, args } = await setup();
  await t.action(internal.telegram.uploadAndReply, args);
  const batch = await t.run((ctx) => ctx.db.query("uploadBatches").first());
  if (!batch?.staging) throw new Error("Expected a staged Telegram upload");
  await t.mutation(api.uploads.completeBatchForService, { id: batch._id, saved: [], savedBytes: 0, serviceToken: "fixture" });
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 95, reserved: 0 });
  external.store.mockClear();

  vi.setSystemTime(batch.staging.expiresAt + 59_999);
  await t.action(internal.stagingStorage.cleanup, { id: batch._id });
  expect(external.store).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 95 });

  vi.setSystemTime(batch.staging.expiresAt + 60_000);
  external.store.mockResolvedValueOnce({ Errors: [{ Code: "AccessDenied", Key: "photo.jpg" }] });
  await expect(t.action(internal.stagingStorage.cleanup, { id: batch._id })).rejects.toThrow("cleanup failed");
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 95 });
  expect(await t.run((ctx) => ctx.db.query("balanceEntries").collect())).toMatchObject([{ reason: "photos", amount: -5 }]);

  await t.action(internal.stagingStorage.cleanup, { id: batch._id });
  expect(external.store).toHaveBeenLastCalledWith(expect.objectContaining({ input: {
    Bucket: "fixture", Delete: { Objects: [{ Key: `uploads/${collectionId}/${batch._id}/photo.jpg` }], Quiet: true },
  } }));
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100 });
  expect(await t.run((ctx) => ctx.db.query("balanceEntries").collect())).toMatchObject([
    { reason: "photos", amount: -5 }, { reason: "photos_returned", amount: 5 },
  ]);
  external.store.mockClear();
  await t.action(internal.stagingStorage.cleanup, { id: batch._id });
  expect(external.store).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100 });
});

test("a Telegram album queues every photo but sends only one acknowledgement", async () => {
  const { t, collectionId } = await setup();
  const args = { collectionId, chatId: "123", serviceToken: "fixture", fileId: "file", mediaGroupId: "album" };
  await t.mutation(api.telegramAccess.queueUpload, { ...args, filename: "Telegram-1.jpg" });
  await t.mutation(api.telegramAccess.queueUpload, { ...args, filename: "Telegram-2.jpg" });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(external.store).toHaveBeenCalledTimes(2);
  expect(external.sendMessage).toHaveBeenCalledTimes(1);
  expect(external.sendMessage).toHaveBeenCalledWith("123", expect.stringContaining("album"));
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 90 });
});

test("closing contributions before a queued Telegram upload runs prevents storage and charging", async () => {
  const { t, collectionId, args } = await setup();
  await t.run((ctx) => ctx.db.patch(collectionId, { crowdsource: false }));
  await t.action(internal.telegram.uploadAndReply, args);
  expect(external.store).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query("uploadBatches").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("balances").first())).toMatchObject({ credit: 100 });
  expect(external.sendMessage).toHaveBeenCalledWith("123", expect.stringContaining("turned off"));
});

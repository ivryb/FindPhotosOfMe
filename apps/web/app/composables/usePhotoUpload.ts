import type { FunctionArgs } from "convex/server";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Doc, Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { BATCH_PHOTOS, photoType } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { defaultWindow, useEventListener } from "@vueuse/core";
import { useConvexClient } from "convex-vue";

/** An upload this tab is sending. Once Convex knows it (`uploadId`), its progress there takes over. */
export type Sending = { key: string; name: string; uploadId?: Id<"uploads">; photos: number; sent: number; tooLarge: number; error?: string };

// Photos uploaded to R2 at once
const PARALLEL = 4;

/**
 * Sends photos straight from the browser to R2, 50 at a time, and registers each batch so workers can start on it
 * while the rest are still uploading. ZIPs are unpacked here, one photo at a time. Adding the same files again
 * continues an upload that stopped. `uploads` is the gallery's uploads as Convex reports them.
 */
export function usePhotoUpload(
  galleryId: MaybeRefOrGetter<Id<"collections">>,
  uploads: MaybeRefOrGetter<Doc<"uploads">[] | undefined>,
  guest?: MaybeRefOrGetter<FunctionArgs<typeof api.uploads.start>["access"]>,
) {
  const convex = useConvexClient();
  const sending = ref<Sending[]>([]);
  /** Whether this tab still has photos to send. Processing needs nothing from the tab. */
  const uploading = computed(() => sending.value.some((entry) => !entry.error));
  // Closing the tab stops the upload, so the browser asks first.
  useEventListener(defaultWindow, "beforeunload", (event) => {
    if (uploading.value) event.preventDefault();
  });
  // A finished upload stays here until Convex reports all its photos sent. Dropped as soon as the last batch was
  // committed, it read as stopped until that news arrived.
  watch(() => toValue(uploads), (known) => {
    sending.value = sending.value.filter((entry) => !known?.some((item) => item._id === entry.uploadId && item.sent === item.photos));
  });

  async function upload(files: File[]) {
    const reading = reactive<Sending>({ key: crypto.randomUUID(), name: files.length === 1 ? files[0]!.name : `${files.length} files`, photos: 0, sent: 0, tooLarge: 0 });
    sending.value = [...sending.value.filter((entry) => !entry.error), reading];
    let sources = await readSources(files).catch(() => undefined);
    sending.value = sending.value.filter((entry) => entry !== reading);
    if (!sources?.length) {
      reading.error = sources ? "There are no JPEG or PNG photos here." : "This ZIP couldn't be opened. Check that it isn't damaged or password-protected.";
      sending.value = [...sending.value, reading];
      return;
    }
    // A ZIP added again while this tab is still sending it would only send the same photos twice.
    const busy = (source: Source) => sending.value.some((entry) => !entry.error && entry.name === source.name && entry.photos === source.photos.length);
    await Promise.all(sources.filter(busy).map((source) => source.close()));
    sources = sources.filter((source) => !busy(source));
    const entries = sources.map((source) => reactive<Sending>({
      key: crypto.randomUUID(), name: source.name, photos: source.photos.length, sent: 0, tooLarge: source.tooLarge,
      error: source.photos.length ? undefined : `All ${source.tooLarge.toLocaleString("en-US")} photos are over 50 MB, the most a photo can be.`,
    }));
    sending.value = [...sending.value, ...entries];
    // One upload at a time keeps each one's photos in order, which is what lets it continue where it stopped.
    for (const [index, source] of sources.entries()) {
      if (!entries[index]!.error) await send(source, entries[index]!);
    }
  }

  async function send(source: Source, entry: Sending) {
    const collectionId = toValue(galleryId);
    const access = toValue(guest);
    // A guest's link is their access. The owner signs every request, so a retry gets a fresh token.
    const headers = async () => (access ? undefined : await authHeaders());
    try {
      // Every step can be repeated safely: a finished ZIP has nothing left to send, and a batch is registered once.
      const { uploadId, sent } = await retrying(() => convex.mutation(api.uploads.start, { collectionId, name: source.name, size: source.size, photos: source.photos.length, access }));
      Object.assign(entry, { uploadId, sent });
      for (let first = sent; first < source.photos.length; first += BATCH_PHOTOS) {
        const batch = source.photos.slice(first, first + BATCH_PHOTOS);
        const photos = batch.map(({ name, size }) => ({ name, size }));
        const presign = async () => $fetch("/api/uploads/presign", { method: "POST", body: { uploadId, first, photos, access }, headers: await headers() });
        const { batchId, urls } = await retrying(presign);
        await inParallel(batch, async (photo, index) => {
          await put(urls[index]!, await photo.read(), photoType(photo.name));
          entry.sent++;
        });
        const complete = async () => $fetch("/api/uploads/complete", { method: "POST", body: { batchId, access }, headers: await headers() });
        await retrying(complete);
      }
    } catch (cause) {
      entry.error = readableError(cause, `Uploading stopped. Check your connection, then add ${source.name} again to continue.`);
    } finally {
      await source.close();
    }
  }

  return { sending, uploading, upload };
}

/** Runs a few at a time; after one fails, the others finish what they're on and take nothing new. */
async function inParallel<T>(items: T[], run: (item: T, index: number) => Promise<void>) {
  let next = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
    while (!failed && next < items.length) {
      const index = next++;
      await run(items[index]!, index).catch((error) => {
        failed = true;
        throw error;
      });
    }
  }));
}

/** Uploads one photo, trying again after a dropped connection or a storage hiccup. */
async function put(url: string, body: Blob, type: string) {
  await retrying(async () => {
    const response = await fetch(url, { method: "PUT", body, headers: { "Content-Type": type } });
    if (!response.ok) throw Object.assign(new Error(`Storage returned ${response.status}`), { statusCode: response.status });
  });
}

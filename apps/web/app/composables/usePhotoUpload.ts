import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
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
 * continues an upload that stopped.
 */
export function usePhotoUpload(galleryId: MaybeRefOrGetter<Id<"collections">>) {
  const convex = useConvexClient();
  const sending = ref<Sending[]>([]);
  // Closing the tab stops the upload, so the browser asks first.
  useEventListener(defaultWindow, "beforeunload", (event) => {
    if (sending.value.some((entry) => !entry.error)) event.preventDefault();
  });

  async function upload(files: File[]) {
    const reading = reactive<Sending>({ key: crypto.randomUUID(), name: files.length === 1 ? files[0]!.name : `${files.length} files`, photos: 0, sent: 0, tooLarge: 0 });
    sending.value = [...sending.value.filter((entry) => !entry.error), reading];
    const sources = await readSources(files).catch(() => undefined);
    sending.value = sending.value.filter((entry) => entry !== reading);
    if (!sources?.length) {
      reading.error = sources ? "There are no JPEG or PNG photos here." : "This ZIP couldn't be opened. Check that it isn't damaged or password-protected.";
      sending.value = [...sending.value, reading];
      return;
    }
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
    try {
      const { uploadId, sent } = await convex.mutation(api.uploads.start, { collectionId, name: source.name, size: source.size, photos: source.photos.length });
      Object.assign(entry, { uploadId, sent });
      for (let first = sent; first < source.photos.length; first += BATCH_PHOTOS) {
        const batch = source.photos.slice(first, first + BATCH_PHOTOS);
        const names = batch.map((photo) => photo.name);
        const { urls } = await $fetch("/api/uploads/presign", {
          method: "POST",
          body: { collectionId, uploadId, names },
          headers: { Authorization: `Bearer ${await getConvexAuthToken()}` },
        });
        await inParallel(batch, async (photo, index) => {
          await put(urls[index]!, await photo.read(), photoType(photo.name));
          entry.sent++;
        });
        await convex.mutation(api.uploads.addBatch, { uploadId, first, names });
      }
      sending.value = sending.value.filter((item) => item !== entry);
    } catch (cause) {
      entry.error = readableError(cause, `Uploading stopped. Check your connection, then add ${source.name} again to continue.`);
    } finally {
      await source.close();
    }
  }

  return { sending, upload };
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

/** Uploads one photo, trying again twice on a dropped connection before giving up. */
async function put(url: string, body: Blob, type: string) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { method: "PUT", body, headers: { "Content-Type": type } }).catch(() => undefined);
    if (response?.ok) return;
    if (attempt === 3) throw new Error(`Storage returned ${response?.status ?? "no response"}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
}

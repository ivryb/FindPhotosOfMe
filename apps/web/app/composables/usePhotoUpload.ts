import type { FunctionArgs } from "convex/server";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Doc, Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { mediaType, nextBatch } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { defaultWindow, useEventListener } from "@vueuse/core";
import { useConvexClient } from "convex-vue";

/**
 * An upload this tab is sending. Once Convex knows it (`uploadId`), its progress there takes over. `partly` is how much
 * of the photos still on their way has arrived, in photos, so a large video moves the progress bar while it uploads.
 */
export type Sending = { key: string; name: string; uploadId?: Id<"uploads">; photos: number; sent: number; partly: number; tooLarge: number; error?: string };

// Photos uploaded to R2 at once
const PARALLEL = 4;

/**
 * Sends photos straight from the browser to R2, 50 at a time and each video on its own, and registers each batch so
 * workers can start on it while the rest are still uploading. ZIPs are unpacked here, one photo at a time. Adding the same files again
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
    const reading = reactive<Sending>({ key: crypto.randomUUID(), name: files.length === 1 ? files[0]!.name : `${files.length} files`, photos: 0, sent: 0, partly: 0, tooLarge: 0 });
    sending.value = [...sending.value.filter((entry) => !entry.error), reading];
    let sources = await readSources(files).catch(() => undefined);
    sending.value = sending.value.filter((entry) => entry !== reading);
    if (!sources?.length) {
      reading.error = sources ? "There are no photos or videos here. Photos can be JPEG or PNG, and videos MP4, MOV or WebM." : "This ZIP couldn't be opened. Check that it isn't damaged or password-protected.";
      sending.value = [...sending.value, reading];
      return;
    }
    // A ZIP added again while this tab is still sending it would only send the same photos twice.
    const busy = (source: Source) => sending.value.some((entry) => !entry.error && entry.name === source.name && entry.photos === source.photos.length);
    await Promise.all(sources.filter(busy).map((source) => source.close()));
    sources = sources.filter((source) => !busy(source));
    const entries = sources.map((source) => reactive<Sending>({
      key: crypto.randomUUID(), name: source.name, photos: source.photos.length, sent: 0, partly: 0, tooLarge: source.tooLarge,
      error: source.photos.length ? undefined : source.tooLarge === 1 ? "This file is too large: photos can be up to 50 MB and videos up to 500 MB."
        : `All ${source.tooLarge.toLocaleString("en-US")} files are too large: photos can be up to 50 MB and videos up to 500 MB.`,
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
      for (let first = sent, batch = nextBatch(source.photos, first); batch.length; first += batch.length, batch = nextBatch(source.photos, first)) {
        const photos = batch.map(({ name, size }) => ({ name, size }));
        const presign = async () => $fetch("/api/uploads/presign", { method: "POST", body: { uploadId, first, photos, access }, headers: await headers() });
        const { batchId, urls } = await retrying(presign);
        await inParallel(batch, async (photo, index) => {
          let arrived = 0;
          await put(urls[index]!, await photo.read(), mediaType(photo.name), (fraction) => {
            entry.partly += fraction - arrived;
            arrived = fraction;
          });
          entry.partly -= arrived;
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

/**
 * Uploads one photo or video, trying again after a dropped connection or a storage hiccup. It reports what fraction has
 * arrived as it goes, which only XMLHttpRequest can tell.
 */
async function put(url: string, body: Blob, type: string, progress: (fraction: number) => void) {
  await retrying(() => new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", type);
    request.upload.onprogress = (event) => progress(event.total ? event.loaded / event.total : 0);
    request.onload = () => (request.status < 300 ? resolve()
      : reject(Object.assign(new Error(`Storage returned ${request.status}`), { statusCode: request.status })));
    request.onerror = () => reject(new Error("The connection dropped"));
    request.send(body);
  }));
}

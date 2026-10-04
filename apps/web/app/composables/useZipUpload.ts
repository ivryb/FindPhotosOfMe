import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { useConvexClient } from "convex-vue";

export type Sending = { id: string; name: string; size: number; progress: number; error?: string };

type Presigned = { url: string; key: string };

/**
 * Sends ZIP files of photos straight to storage, one at a time, and queues each for face finding as soon as it lands.
 * `sending` lists the files still on their way; a failed one stays with its error until the next upload starts.
 */
export function useZipUpload(galleryId: MaybeRefOrGetter<Id<"collections">>) {
  const convex = useConvexClient();
  const sending = ref<Sending[]>([]);

  async function send(file: File, entry: Sending) {
    const id = toValue(galleryId);
    const name = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const presigned = await $fetch<Presigned>("/api/r2/presign-upload", {
      method: "POST",
      body: { collectionId: id, key: `uploads/${id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${name}`, contentType: "application/zip" },
      headers: { Authorization: `Bearer ${await getConvexAuthToken()}` },
    });
    await put(presigned.url, file, (progress) => (entry.progress = progress));
    await convex.mutation(api.ingestJobs.create, { collectionId: id, fileKey: presigned.key, filename: name });
  }

  /** Can run again while files are still sending; the new files join the list, and earlier errors are cleared. */
  async function upload(files: File[]) {
    const entries = files.map((file) => reactive<Sending>({ id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0 }));
    sending.value = [...sending.value.filter((entry) => !entry.error), ...entries];
    for (const [index, file] of files.entries()) {
      const entry = entries[index]!;
      try {
        await send(file, entry);
        sending.value = sending.value.filter((item) => item !== entry);
      } catch (cause) {
        entry.error = readableError(cause, "This ZIP didn't upload. Check your connection and try again.");
      }
    }
  }

  return { sending, upload };
}

/** A PUT that reports how much has been sent, which fetch can't do for uploads. */
function put(url: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", "application/zip");
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error(`Storage returned ${request.status}`)));
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(file);
  });
}

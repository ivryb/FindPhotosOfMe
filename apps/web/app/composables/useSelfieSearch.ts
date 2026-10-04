import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import type { GalleryPhoto } from "#shared/types/gallery";
import { useConvexClient } from "convex-vue";

export const SELFIE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SELFIE_BYTES = 10 * 1024 * 1024;

/** Where a visitor's selfie search stands. Every state after a selfie is chosen keeps it, for the banner and sheet. */
export type SelfieSearch =
  | { kind: "idle" }
  | { kind: "searching"; selfie: string }
  | { kind: "found"; selfie: string; photos: GalleryPhoto[] }
  | { kind: "none"; selfie: string }
  | { kind: "no_face"; selfie: string }
  | { kind: "unreadable"; selfie: string; message: string }
  | { kind: "failed"; selfie: string }
  | { kind: "paused"; message: string };

/** Runs selfie searches against one gallery. The search finishes before `/api/search` answers. */
export function useSelfieSearch(galleryId: MaybeRefOrGetter<Id<"collections">>) {
  const convex = useConvexClient();
  const state = shallowRef<SelfieSearch>({ kind: "idle" });

  async function search(file: File) {
    if ("selfie" in state.value) URL.revokeObjectURL(state.value.selfie);
    const selfie = URL.createObjectURL(file);
    if (!SELFIE_TYPES.includes(file.type)) {
      state.value = { kind: "unreadable", selfie, message: "Use a JPEG, PNG, or WebP photo." };
      return;
    }
    if (file.size > MAX_SELFIE_BYTES) {
      state.value = { kind: "unreadable", selfie, message: "Use a photo of 10 MB or less." };
      return;
    }

    state.value = { kind: "searching", selfie };
    const body = new FormData();
    body.append("collection_id", toValue(galleryId));
    body.append("reference_photo", file);
    try {
      // Nitro's inferred response type turns the ID into a plain object type, so the type is named here.
      const { requestId } = await $fetch<{ requestId: Id<"searchRequests"> }>("/api/search", { method: "POST", body });
      const request = await convex.query(api.searchRequests.get, { id: requestId });
      if (request?.status === "complete") {
        state.value = request.imagesFound.length
          ? { kind: "found", selfie, photos: await photoLinks(requestId, request.imagesFound) }
          : { kind: "none", selfie };
      } else {
        state.value = request?.error === "no_face" ? { kind: "no_face", selfie } : { kind: "failed", selfie };
      }
    } catch (error) {
      // A refused search, such as when the gallery owner's balance is empty, says why.
      const message = refusal(error);
      state.value = message ? { kind: "paused", message } : { kind: "failed", selfie };
    }
  }

  return { state, search };
}

async function photoLinks(requestId: Id<"searchRequests">, keys: string[]) {
  const { photos } = await $fetch("/api/r2/authorize", { method: "POST", body: { requestId, keys } });
  return photos;
}

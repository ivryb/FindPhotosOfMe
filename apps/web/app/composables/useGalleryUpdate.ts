import type { FunctionArgs } from "convex/server";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import type { Gallery } from "@/utils/galleries";

type Changes = Partial<Omit<FunctionArgs<typeof api.collections.update>, "id">>;

/**
 * Saves some of a gallery's settings. `update` replaces the address, name, description, and welcome message it's given,
 * so the gallery's saved values go along with the changes; unsaved edits elsewhere on the page stay out.
 * Each caller gets its own `saving`, `saved`, and `error`.
 */
export function useGalleryUpdate(gallery: MaybeRefOrGetter<Gallery>) {
  const { mutate } = useConvexMutation(api.collections.update);
  const saving = ref(false);
  const saved = ref(false);
  const error = ref<string>();

  async function save(changes: Changes) {
    const { _id: id, subdomain, title, description, welcomeMessage } = toValue(gallery);
    saving.value = true;
    saved.value = false;
    error.value = undefined;
    try {
      await mutate({ id, subdomain, title, description, welcomeMessage, ...changes });
      saved.value = true;
      return true;
    } catch (cause) {
      error.value = readableError(cause);
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { save, saving, saved, error };
}

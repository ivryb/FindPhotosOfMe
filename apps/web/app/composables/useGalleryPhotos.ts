import type { GalleryPhoto, GalleryPhotos } from "#shared/types/gallery";
import { mediaLinks } from "#shared/utils/media";

/**
 * Every photo a gallery's visitors may browse, fetched in one request, so any part of the gallery can show at once.
 * `load` fetches them once and can be called again after a failure. With `preload`, the page's head starts the
 * request while the app's scripts are still loading, and `load` picks up its response.
 */
export function useGalleryPhotos(galleryId: MaybeRefOrGetter<string>, { preload = false, owner = false } = {}) {
  const url = computed(() => `/api/galleries/${toValue(galleryId)}/photos`);
  if (preload) useHead({ link: [{ rel: "preload", as: "fetch", href: url, crossorigin: "anonymous" }] });

  const photos = shallowRef<GalleryPhoto[]>([]);
  const loaded = ref(false);
  const failed = ref(false);
  let loading = false;

  async function load() {
    if (loading || loaded.value) return;
    loading = true;
    failed.value = false;
    try {
      const headers = owner ? { Authorization: `Bearer ${await getConvexAuthToken()}` } : undefined;
      const body = await $fetch<GalleryPhotos>(url.value, { headers });
      photos.value = body.keys.map((key) => mediaLinks(key));
      loaded.value = true;
    } catch {
      failed.value = true;
    } finally {
      loading = false;
    }
  }

  return { photos, loaded, failed, load };
}

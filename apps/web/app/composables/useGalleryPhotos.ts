import type { GalleryPhoto, GalleryPhotos } from "#shared/types/gallery";
import { mediaLinks } from "#shared/utils/media";

/**
 * Every photo a gallery's visitors may browse, fetched in one request, so any part of the gallery can show at once.
 * `load` fetches them once and can be called again after a failure. With `preload`, the page's head starts the
 * request while the app's scripts are still loading, and `load` picks up its response.
 */
export function useGalleryPhotos(galleryId: MaybeRefOrGetter<string>, { preload = false, owner = false, shareToken }: { preload?: boolean; owner?: boolean; shareToken?: string } = {}) {
  const url = computed(() => `/api/galleries/${toValue(galleryId)}/photos${shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ""}`);
  if (preload) useHead({ link: [{ rel: "preload", as: "fetch", href: url, crossorigin: "anonymous" }] });

  const photos = shallowRef<GalleryPhoto[]>([]);
  const loaded = ref(false);
  const failed = ref(false);
  let loading = false;
  let refreshQueued = false;

  async function load(refresh = false) {
    // Several processing batches can finish while one listing is still loading.
    if (loading) { refreshQueued ||= refresh; return; }
    // A failed refresh still has old photos, but its retry must fetch again.
    if (loaded.value && !failed.value && !refresh) return;
    loading = true;
    failed.value = false;
    try {
      const headers = owner ? { Authorization: `Bearer ${await getConvexAuthToken()}` } : undefined;
      const body = await $fetch<GalleryPhotos>(url.value, { headers });
      photos.value = body.keys.map((key) => mediaLinks(key, { shareToken }));
      loaded.value = true;
    } catch {
      failed.value = true;
    } finally {
      loading = false;
      if (refreshQueued) { refreshQueued = false; await load(true); }
    }
  }

  return { photos, loaded, failed, load };
}

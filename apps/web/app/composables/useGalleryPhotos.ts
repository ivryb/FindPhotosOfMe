import type { GalleryPage, GalleryPhoto } from "#shared/types/gallery";

/**
 * A public gallery's photos, fetched a page at a time as the visitor scrolls.
 * `loadMore` can be called as often as the grid likes; it runs one request at a time and stops at the end.
 */
export function useGalleryPhotos(galleryId: MaybeRefOrGetter<string>) {
  const photos = shallowRef<GalleryPhoto[]>([]);
  // undefined before the first page, null after the last
  const cursor = ref<string | null | undefined>(undefined);
  const loading = ref(false);
  const failed = ref(false);
  const done = computed(() => cursor.value === null);

  async function loadMore() {
    if (loading.value || done.value) return;
    loading.value = true;
    failed.value = false;
    try {
      const page = await $fetch<GalleryPage>(`/api/galleries/${toValue(galleryId)}/photos`, {
        query: cursor.value ? { after: cursor.value } : {},
      });
      photos.value = [...photos.value, ...page.photos];
      cursor.value = page.next;
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  }

  return { photos, loadMore, loading, done, failed };
}

<script setup lang="ts">
import type { FunctionReturnType } from "convex/server";
import type { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { GalleryPhoto } from "#shared/types/gallery";

const props = defineProps<{ gallery: NonNullable<FunctionReturnType<typeof api.collections.getPublic>>; shareToken?: string }>();
const home = useRuntimeConfig().public.origin || "/";
const { photos, loaded, failed, load } = useGalleryPhotos(() => props.gallery._id, { preload: true, shareToken: props.shareToken });
onMounted(() => load());
// Enabling contributions also reveals existing photos without changing their count.
watch([() => props.gallery.imagesCount, () => props.gallery.showAllPhotos], () => load(true));
// Galleries that show only previews have just those to browse; search still covers every photo.
const browsable = computed(() => (props.gallery.showAllPhotos ? props.gallery.imagesCount : props.gallery.previewImages.length));
const sheet = ref<"upload" | "search" | null>(null);
watch([() => props.gallery.crowdsource, () => props.gallery.imagesCount], ([uploadsEnabled, photos]) => {
  // An owner can remove an open action while a guest is on the page.
  if ((sheet.value === "upload" && !uploadsEnabled) || (sheet.value === "search" && !photos)) sheet.value = null;
});

// One viewer for the gallery and for the photos a search found.
const viewer = reactive({ open: false, index: 0, found: null as GalleryPhoto[] | null });
const viewerPhotos = computed(() => viewer.found ?? photos.value);
watch(photos, (next, previous) => {
  // New contributions can sort before the photo someone is viewing.
  if (!viewer.open || viewer.found) return;
  const key = previous[viewer.index]?.key;
  const index = next.findIndex((photo) => photo.key === key);
  if (index >= 0) viewer.index = index;
});
function view(index: number, found: GalleryPhoto[] | null = null) {
  Object.assign(viewer, { open: true, index, found });
}
</script>

<template>
  <div class="gallery-page">
    <header class="wrap top"><a class="logo" :href="home"><img src="/icon.svg" alt="">FindPhotosOfMe</a></header>

    <section class="wrap intro">
      <h1>{{ gallery.title }}</h1>
      <p class="about">
        <b>{{ count.format(gallery.imagesCount) }} photos</b>
        <span v-if="gallery.description">{{ gallery.description }}</span>
      </p>
      <p v-if="!gallery.showAllPhotos" class="selection">You’re seeing a few of the photos. Search with a selfie to find every photo you’re in.</p>
    </section>

    <p v-if="!gallery.imagesCount" class="wrap empty">{{ gallery.crowdsource ? "Be the first to share a photo from this event." : "Photos will appear here soon." }}</p>

    <main class="wide">
      <GalleryGrid :photos="photos" :total="browsable" :loaded="loaded" :failed="failed" @retry="load()" @open="view" />
    </main>

    <div v-show="!sheet" class="gallery-actions" aria-label="Gallery actions">
      <GalleryUpload v-if="gallery.crowdsource" :gallery-id="gallery._id" :share-token="shareToken"
        :open="sheet === 'upload'" @update:open="sheet = $event ? 'upload' : sheet === 'upload' ? null : sheet" />
      <GallerySearch v-if="gallery.imagesCount" compact :share-token="shareToken" :gallery-id="gallery._id" :total="gallery.imagesCount"
        :open="sheet === 'search'" @update:open="sheet = $event ? 'search' : sheet === 'search' ? null : sheet"
        @view="(found: GalleryPhoto[], index: number) => view(index, found)" />
    </div>
    <GalleryViewer v-model:open="viewer.open" v-model:index="viewer.index" :photos="viewerPhotos" />
  </div>
</template>

<style scoped>
.empty { padding-block: 36px; color: #b3b3ad; }
.gallery-page { min-height: 100vh; background: var(--foreground); color: var(--background); }
.gallery-page :focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; }
.wrap { max-width: 1140px; margin-inline: auto; padding-inline: clamp(20px, 4vw, 40px); }
.top { display: flex; align-items: center; height: 64px; }
.logo { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
.logo img { width: 28px; height: 28px; }
/* The gallery name gets the full width; the count and description sit under it */
.intro { padding-block: clamp(16px, 3vw, 36px) clamp(24px, 3vw, 36px); }
.intro h1 { font-size: clamp(2.4rem, 6.4vw, 5.4rem); }
.about { display: flex; flex-wrap: wrap; gap: 4px 20px; max-width: 72ch; margin-top: clamp(14px, 2vw, 22px); color: #b3b3ad; white-space: pre-line; }
.about b { color: var(--background); font-weight: 800; font-stretch: 112%; white-space: nowrap; }
.selection { max-width: 60ch; margin-top: 14px; color: #b3b3ad; font-size: .95rem; }
.wide { max-width: 1600px; margin-inline: auto; padding: 0 clamp(4px, 1.5vw, 20px) 110px; }
.gallery-actions { position: fixed; bottom: max(16px, calc(env(safe-area-inset-bottom) + 8px)); left: 50%; z-index: 30; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 24px); translate: -50% 0; }
.gallery-actions :deep(.gallery-action) { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 52px; padding: 12px 18px; background: var(--brand); color: var(--brand-foreground); border-radius: 999px; box-shadow: 0 8px 28px rgb(0 0 0 / .4); font-weight: 800; white-space: nowrap; cursor: pointer; }
.gallery-actions :deep(.gallery-action:hover) { background: #ffe05b; }
.gallery-actions :deep(.gallery-action:focus-visible) { outline: 3px solid #fff; outline-offset: 3px; }
.gallery-actions :deep(.gallery-action > svg) { flex: none; width: 20px; height: 20px; }
@media (max-width: 420px) {
  .gallery-actions { gap: 8px; }
  .gallery-actions :deep(.gallery-action) { gap: 7px; min-height: 48px; padding-inline: 15px; font-size: .9rem; }
}
@media (max-width: 350px) {
  .gallery-actions :deep(.gallery-action) { gap: 6px; padding-inline: 10px; font-size: .85rem; }
  .gallery-actions :deep(.gallery-action > svg) { width: 18px; height: 18px; }
}
</style>

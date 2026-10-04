<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { GalleryPhoto } from "#shared/types/gallery";
import { useSubdomain } from "@/composables/useSubdomain";

// A gallery's public page, opened from its own subdomain: every photo, and a selfie search over them.
const subdomain = useSubdomain();
if (!subdomain) await navigateTo("/");

const { data: gallery } = await useConvexSSRQuery(api.collections.getPublicBySubdomain, { subdomain: subdomain ?? "" });
if (!gallery.value) throw createError({ statusCode: 404, statusMessage: "This gallery isn’t online" });
const current = computed(() => gallery.value!);

useSeoMeta({
  title: () => `${current.value.title} photos`,
  description: () => `Find the photos you’re in from ${current.value.title} with a selfie.`,
});
useHead({ bodyAttrs: { style: "background: #151515" } });

const count = new Intl.NumberFormat("en-US");
const { photos, loadMore, loading, done, failed } = useGalleryPhotos(() => current.value._id);
onMounted(loadMore);
// Galleries that show only previews have just those to browse; search still covers every photo.
const browsable = computed(() => (current.value.showAllPhotos ? current.value.imagesCount : current.value.previewImages.length));

// One viewer for the gallery and for the photos a search found.
const viewer = reactive({ open: false, index: 0, found: null as GalleryPhoto[] | null });
const viewerPhotos = computed(() => viewer.found ?? photos.value);
const viewerTotal = computed(() => (viewer.found ? viewer.found.length : browsable.value));
function view(index: number, found: GalleryPhoto[] | null = null) {
  Object.assign(viewer, { open: true, index, found });
}
</script>

<template>
  <div class="gallery-page">
    <header class="wrap top"><NuxtLink class="logo" to="/">FindPhotosOfMe</NuxtLink></header>

    <section class="wrap intro">
      <h1>{{ current.title }}</h1>
      <p class="about">
        <b>{{ count.format(current.imagesCount) }} photos</b>
        <span v-if="current.description">{{ current.description }}</span>
      </p>
      <p v-if="!current.showAllPhotos" class="selection">You’re seeing a few of the photos. Search with a selfie to find every photo you’re in.</p>
    </section>

    <main class="wide">
      <GalleryGrid :photos="photos" :total="browsable" :loading="loading" :failed="failed" :done="done" @more="loadMore" @open="view" />
    </main>

    <GallerySearch :gallery-id="current._id" :total="current.imagesCount" @view="(found: GalleryPhoto[], index: number) => view(index, found)" />
    <GalleryViewer v-model:open="viewer.open" v-model:index="viewer.index" :photos="viewerPhotos" :total="viewerTotal" @more="!viewer.found && loadMore()" />
  </div>
</template>

<style scoped>
.gallery-page { min-height: 100vh; background: var(--foreground); color: var(--background); }
.gallery-page :focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; }
.wrap { max-width: 1140px; margin-inline: auto; padding-inline: clamp(20px, 4vw, 40px); }
.top { display: flex; align-items: center; height: 64px; }
.logo { font-size: 1rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
/* The gallery name gets the full width; the count and description sit under it */
.intro { padding-block: clamp(16px, 3vw, 36px) clamp(24px, 3vw, 36px); }
.intro h1 { font-size: clamp(2.4rem, 6.4vw, 5.4rem); }
.about { display: flex; flex-wrap: wrap; gap: 4px 20px; max-width: 72ch; margin-top: clamp(14px, 2vw, 22px); color: #b3b3ad; white-space: pre-line; }
.about b { color: var(--background); font-weight: 800; font-stretch: 112%; white-space: nowrap; }
.selection { max-width: 60ch; margin-top: 14px; color: #b3b3ad; font-size: .95rem; }
.wide { max-width: 1600px; margin-inline: auto; padding: 0 clamp(4px, 1.5vw, 20px) 180px; }
@media (max-width: 760px) { .wide { padding-bottom: 110px; } }
</style>

<script setup lang="ts">
import { useElementSize, useElementVisibility, whenever } from "@vueuse/core";
import { Camera, Upload } from "@lucide/vue";
import type { Gallery } from "@/utils/galleries";

// The gallery page as a phone shows it: laid out at phone width, then scaled to fit, following unsaved settings.
const props = defineProps<{ gallery: Gallery; title: string; description: string; browse: boolean; uploads: boolean }>();

const WIDTH = 390;
const frame = useTemplateRef("frame");
const { width } = useElementSize(frame);

// The tab stays mounted while hidden, so the photos load only once the preview is on screen.
const { photos, load } = useGalleryPhotos(() => props.gallery._id, { owner: true });
whenever(useElementVisibility(frame), load, { once: true });
// Without browsing, visitors see a few photos and search for the rest.
const tiles = computed(() => Array.from({ length: props.browse ? 18 : 6 }, (_, n) => photos.value[n]));

const address = useGalleryAddress();
const link = computed(() => (props.gallery.published === false ? "" : address.link(props.gallery)));
</script>

<template>
  <figure>
    <div ref="frame" class="frame" role="img" aria-label="Preview of your gallery page on a phone">
      <div class="page" :style="{ width: `${WIDTH}px`, zoom: width ? width / WIDTH : undefined }">
        <header><img src="/icon.svg" alt="">FindPhotosOfMe</header>
        <section class="intro">
          <h1>{{ title || "Untitled gallery" }}</h1>
          <p class="about"><b>{{ count.format(gallery.imagesCount) }} photos</b><span v-if="description">{{ description }}</span></p>
          <p v-if="!browse" class="selection">You’re seeing a few of the photos. Search with a selfie to find every photo you’re in.</p>
        </section>
        <div class="grid">
          <span v-for="(photo, n) in tiles" :key="n"><img v-if="photo" :src="photo.thumb" alt=""></span>
        </div>
        <div class="actions">
          <span v-if="uploads"><Upload />Add photos</span>
          <span v-if="gallery.imagesCount"><Camera />Find me</span>
        </div>
      </div>
    </div>
    <figcaption>
      <template v-if="link"><span>{{ link.replace(/^https?:\/\//, "") }}</span><a :href="link" target="_blank">Open page</a></template>
      <span v-else>Private · only you can open it</span>
    </figcaption>
  </figure>
</template>

<style scoped>
/* Sizes are the gallery page's own at phone width, so the scaled copy matches it */
.frame { overflow: hidden; background: var(--foreground); border-radius: 14px; box-shadow: var(--lift); }
.page { position: relative; height: 760px; overflow: hidden; background: var(--foreground); color: var(--background); }
header { display: flex; align-items: center; gap: 10px; height: 64px; padding-inline: 20px; font-size: 1rem; font-weight: 900; font-stretch: 118%; letter-spacing: -.02em; }
header img { width: 28px; height: 28px; }
.intro { padding: 16px 20px 24px; }
.intro h1 { font-size: 2.4rem; overflow-wrap: anywhere; }
.about { display: flex; flex-wrap: wrap; gap: 4px 20px; margin-top: 14px; color: #b3b3ad; white-space: pre-line; }
.about b { color: var(--background); font-weight: 800; font-stretch: 112%; white-space: nowrap; }
.selection { margin-top: 14px; color: #b3b3ad; font-size: .95rem; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding-inline: 4px; }
.grid span { aspect-ratio: 4 / 3; background: #222220; }
.grid img { width: 100%; height: 100%; object-fit: cover; }
.actions { position: absolute; bottom: 24px; left: 50%; display: flex; gap: 8px; translate: -50% 0; }
.actions span { display: inline-flex; align-items: center; gap: 7px; min-height: 48px; padding: 12px 15px; background: var(--brand); color: var(--brand-foreground); border-radius: 999px; box-shadow: 0 8px 28px rgb(0 0 0 / .4); font-size: .9rem; font-weight: 800; white-space: nowrap; }
.actions svg { width: 20px; height: 20px; }
figcaption { display: flex; justify-content: space-between; gap: 4px 12px; margin-top: 10px; color: var(--muted-foreground); font-size: .86rem; }
figcaption span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
figcaption a { flex: none; color: var(--foreground); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
</style>

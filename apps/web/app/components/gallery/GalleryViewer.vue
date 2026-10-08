<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, X } from "@lucide/vue";
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import type { GalleryPhoto } from "#shared/types/gallery";

// Full-screen photos. It opens on the thumbnail and sharpens as the screen-sized version loads.
// Arrow keys and swipes move through `photos`.
const open = defineModel<boolean>("open", { required: true });
const index = defineModel<number>("index", { required: true });
const props = defineProps<{ photos: GalleryPhoto[] }>();

const photo = computed(() => props.photos[index.value]);
const sharp = ref(false);
// Photos processed before screen versions existed show the original until the backfill has made theirs.
const original = ref(false);

function go(step: number) {
  const next = index.value + step;
  if (next >= 0 && next < props.photos.length) index.value = next;
}

watch([index, open], () => {
  sharp.value = false;
  original.value = false;
  if (!open.value) return;
  // Start the neighbors early so moving through photos feels instant.
  for (const neighbor of [props.photos[index.value + 1], props.photos[index.value - 1]]) {
    if (neighbor) new Image().src = neighbor.screen;
  }
}, { immediate: true });

let swipeFrom: number | null = null;
function swipeEnd(event: PointerEvent) {
  const distance = event.clientX - (swipeFrom ?? event.clientX);
  if (Math.abs(distance) > 50) go(distance < 0 ? 1 : -1);
  swipeFrom = null;
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="photo-viewer-backdrop" />
      <DialogContent v-if="photo" class="photo-viewer" @keydown.right="go(1)" @keydown.left="go(-1)">
        <div class="photo-viewer-bar">
          <DialogTitle class="photo-viewer-count">{{ count.format(index + 1) }} of {{ count.format(photos.length) }}</DialogTitle>
          <div>
            <a class="photo-viewer-button" :href="photo.download" aria-label="Download this photo"><Download /></a>
            <DialogClose class="photo-viewer-button" aria-label="Close"><X /></DialogClose>
          </div>
        </div>
        <div class="photo-viewer-stage" @pointerdown="swipeFrom = $event.clientX" @pointerup="swipeEnd">
          <img v-show="!sharp" class="photo-viewer-placeholder" :src="photo.thumb" alt="" aria-hidden="true">
          <img :key="photo.key" class="photo-viewer-photo" :class="{ sharp }" :src="original ? photo.full : photo.screen" :alt="`Photo ${index + 1}`" @load="sharp = true" @error="original = true">
          <button v-if="index > 0" type="button" class="photo-viewer-button photo-viewer-prev" aria-label="Previous photo" @click="go(-1)"><ChevronLeft /></button>
          <button v-if="index < photos.length - 1" type="button" class="photo-viewer-button photo-viewer-next" aria-label="Next photo" @click="go(1)"><ChevronRight /></button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<!-- Not scoped: the viewer is teleported to the end of the page. -->
<style>
.photo-viewer-backdrop { position: fixed; inset: 0; z-index: 60; background: #0a0a0a; }
.photo-viewer { position: fixed; inset: 0; z-index: 61; display: grid; grid-template-rows: auto minmax(0, 1fr); color: #fff; }
.photo-viewer:focus { outline: none; }
.photo-viewer :focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
.photo-viewer-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px clamp(12px, 2vw, 20px); }
.photo-viewer-bar > div { display: flex; gap: 8px; }
.photo-viewer-count { color: #b3b3ad; font-size: .95rem; font-weight: 400; font-variant-numeric: tabular-nums; }
.photo-viewer-button { display: grid; place-items: center; width: 44px; height: 44px; background: rgb(255 255 255 / .1); color: inherit; border-radius: 50%; cursor: pointer; }
.photo-viewer-button:hover { background: rgb(255 255 255 / .2); }
.photo-viewer-button svg { width: 22px; height: 22px; }
/* Bound both tracks so a large photo's intrinsic size cannot push it past the viewport. */
.photo-viewer-stage { position: relative; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); place-items: center; min-height: 0; padding: 0 clamp(0px, 6vw, 88px) clamp(12px, 3vw, 32px); touch-action: pan-y; }
.photo-viewer-stage img { grid-area: 1 / 1; max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; }
.photo-viewer-placeholder { width: 100%; height: 100%; filter: blur(12px); opacity: .6; }
.photo-viewer-photo { opacity: 0; transition: opacity .3s ease; }
.photo-viewer-photo.sharp { opacity: 1; }
.photo-viewer-prev, .photo-viewer-next { position: absolute; top: 50%; translate: 0 -50%; }
.photo-viewer-prev { left: clamp(8px, 2vw, 24px); }
.photo-viewer-next { right: clamp(8px, 2vw, 24px); }
@media (pointer: coarse) { .photo-viewer-prev, .photo-viewer-next { display: none; } }
@media (prefers-reduced-motion: reduce) { .photo-viewer-photo { transition: none; } }
</style>

<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, X } from "@lucide/vue";
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import type PhotoSwipe from "photoswipe";
import type { SlideData } from "photoswipe";
import "photoswipe/style.css";
import type { GalleryPhoto } from "#shared/types/gallery";

// Full-screen photos on PhotoSwipe: drag between photos, pinch or double-tap to zoom, drag down to close. Each photo
// opens on its thumbnail and sharpens as the screen-sized version loads. The viewer keeps the photos it opened with;
// photos added meanwhile show the next time it opens.
const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ photos: GalleryPhoto[]; index: number }>();

const viewer = shallowRef<PhotoSwipe>();
// PhotoSwipe lives inside a dialog layer, so a sheet open beneath (the search results) yields taps, Escape and focus to it.
const layer = ref(false);
const stage = useTemplateRef("stage");
const photos = shallowRef<GalleryPhoto[]>([]);
const current = ref(0);
const photo = computed(() => photos.value[current.value]);

// In-app browsers such as Telegram's show the page, never fixed layers, under their toolbars. While the viewer covers
// the page, the page is hidden and the viewer's background shows there instead. Dragging a photo down to close
// brings the page back into view behind it.
const revealing = ref(false);
useHead({ htmlAttrs: { "data-viewer": computed(() => (viewer.value && open.value && !revealing.value ? "" : undefined)) } });

// PhotoSwipe lays a photo out by its size, which only its files know. Thumbnails have the screen version's shape
// (python/services/renditions.py), and the page has usually loaded them already.
type Size = { width: number; height: number };
const THUMB_EDGE = 640;
const SCREEN_EDGE = 2048;
const GUESS: Size = { width: 2048, height: 1365 };
const sizes = new Map<string, Size>();
const measuring = new Map<string, Promise<void>>();
// Photos processed before screen versions existed show the original until the backfill has made theirs.
const originals = new Set<string>();

// PhotoSwipe asks for a neighbor's data more than once; each photo's thumbnail is read once.
function measure(photo: GalleryPhoto) {
  const pending = measuring.get(photo.key) ?? readSize(photo);
  measuring.set(photo.key, pending);
  return pending;
}

function readSize(photo: GalleryPhoto) {
  return new Promise<void>((resolve) => {
    const thumb = new Image();
    thumb.onload = () => {
      const long = Math.max(thumb.naturalWidth, thumb.naturalHeight);
      // Photos smaller than a thumbnail keep their size in every copy.
      const scale = long < THUMB_EDGE ? 1 : SCREEN_EDGE / long;
      sizes.set(photo.key, { width: Math.round(thumb.naturalWidth * scale), height: Math.round(thumb.naturalHeight * scale) });
      resolve();
    };
    thumb.onerror = () => {
      sizes.set(photo.key, GUESS);
      resolve();
    };
    thumb.src = photo.thumb;
  });
}

function slide(photo: GalleryPhoto, index: number): SlideData {
  return {
    ...(sizes.get(photo.key) ?? GUESS),
    src: originals.has(photo.key) ? photo.full : photo.screen,
    msrc: photo.thumb,
    alt: `Photo ${index + 1}`,
    // The tile to zoom from and back to. Sheets come after the page, so a search result wins over the grid behind it.
    element: [...document.querySelectorAll<HTMLElement>(`[data-photo="${CSS.escape(photo.key)}"]`)].at(-1),
    thumbCropped: true,
  };
}

// Phones use the whole screen below the bar; larger screens keep room for the arrows.
function padding({ x = 0 }) {
  const side = x < 640 ? 0 : Math.min(88, x * 0.06);
  return { top: 68, bottom: Math.min(32, Math.max(12, x * 0.03)), left: side, right: side };
}

watch(open, (value) => (value ? show() : viewer.value?.close()));

async function show() {
  if (viewer.value || layer.value) return;
  try {
    await create();
  } finally {
    // A failed load, such as a chunk removed by a deploy, must not leave the viewer unable to open again.
    if (!viewer.value) {
      layer.value = false;
      open.value = false;
    }
  }
}

async function create() {
  const list = toRaw(props.photos);
  const start = props.index;
  const first = list[start];
  if (!first) return;
  layer.value = true;
  const [{ default: PhotoSwipe }] = await Promise.all([import("photoswipe"), measure(first), nextTick()]);
  if (!open.value || viewer.value || !stage.value) return;

  // The dialog layer traps focus and handles Escape.
  const pswp = new PhotoSwipe({ dataSource: list, index: start, appendToEl: stage.value, trapFocus: false, returnFocus: false, escKey: false,
    bgOpacity: 1, loop: false, paddingFn: padding, mainClass: "photo-viewer", errorMsg: "This photo couldn’t load." });
  // The controls are drawn below, inside PhotoSwipe's root.
  pswp.on("uiRegister", () => {
    if (pswp.ui) pswp.ui.uiElementsData = [];
  });
  pswp.addFilter("itemData", (_, index) => {
    const photo = list[index]!;
    if (!sizes.has(photo.key)) measure(photo).then(() => viewer.value === pswp && pswp.refreshSlideContent(index));
    return slide(photo, index);
  });
  // Every photo shows its thumbnail while it loads, not just the first.
  pswp.addFilter("placeholderSrc", (_, content) => content.data.msrc ?? false);
  pswp.on("loadError", ({ content }) => {
    const photo = list[content.index];
    if (!photo || originals.has(photo.key)) return;
    originals.add(photo.key);
    pswp.refreshSlideContent(content.index);
  });
  pswp.on("change", () => (current.value = pswp.currIndex));
  pswp.on("verticalDrag", () => (revealing.value = true));
  pswp.on("pinchClose", () => (revealing.value = true));
  pswp.on("pointerUp", () => (revealing.value = false));
  pswp.on("close", () => (open.value = false));
  pswp.on("destroy", () => {
    viewer.value = undefined;
    layer.value = false;
    revealing.value = false;
  });

  photos.value = list;
  current.value = start;
  pswp.init();
  viewer.value = pswp;
}

// Leaving the page while a photo is open, such as with a back gesture, must not leave PhotoSwipe on the next page.
onScopeDispose(() => viewer.value?.destroy());
</script>

<template>
  <DialogRoot :open="layer" @update:open="(value) => value || viewer?.close()">
    <DialogPortal>
      <DialogContent class="photo-viewer-layer" :aria-describedby="undefined">
        <DialogTitle class="sr-only">Photo {{ current + 1 }} of {{ photos.length }}</DialogTitle>
        <div ref="stage" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <Teleport v-if="viewer?.element && photo" :to="viewer.element">
    <div class="photo-viewer-bar">
      <p class="photo-viewer-count pswp__hide-on-close">{{ count.format(current + 1) }} of {{ count.format(photos.length) }}</p>
      <a class="photo-viewer-button pswp__hide-on-close" :href="photo.download" aria-label="Download this photo"><Download /></a>
      <button type="button" class="photo-viewer-button pswp__hide-on-close" aria-label="Close" @click="viewer.close()"><X /></button>
    </div>
    <button v-if="current > 0" type="button" class="photo-viewer-button photo-viewer-prev pswp__hide-on-close" aria-label="Previous photo" @click="viewer.prev()"><ChevronLeft /></button>
    <button v-if="current < photos.length - 1" type="button" class="photo-viewer-button photo-viewer-next pswp__hide-on-close" aria-label="Next photo" @click="viewer.next()"><ChevronRight /></button>
  </Teleport>
</template>

<!-- Not scoped: PhotoSwipe draws the viewer at the end of the page. -->
<style>
/* The page stays in view until the opening zoom has finished, and returns as soon as the viewer starts closing. */
html[data-viewer] { background: #0a0a0a; }
html[data-viewer] #__nuxt { visibility: hidden; transition: visibility 0s .35s; }

.photo-viewer-layer { position: fixed; inset: 0; z-index: 60; }
.photo-viewer-layer:focus { outline: none; }
.photo-viewer { --pswp-root-z-index: 60; --pswp-bg: #0a0a0a; --pswp-placeholder-bg: #0a0a0a; color: #fff; }
.photo-viewer :focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
/* The bar lets drags through to the photo; only its controls take taps. */
.photo-viewer-bar { position: absolute; inset: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 12px clamp(12px, 2vw, 20px); pointer-events: none; }
.photo-viewer-count { margin-right: auto; pointer-events: none !important; color: #b3b3ad; font-size: .95rem; font-variant-numeric: tabular-nums; }
/* Translucent dark, so the buttons stay visible over a zoomed-in photo. */
.photo-viewer-button { display: grid; place-items: center; width: 44px; height: 44px; background: rgb(28 28 28 / .7); color: inherit; border-radius: 50%; cursor: pointer; }
.photo-viewer-button:hover { background: rgb(60 60 60 / .8); }
.photo-viewer-button svg { width: 22px; height: 22px; }
.photo-viewer-prev, .photo-viewer-next { position: absolute; top: 50%; translate: 0 -50%; }
.photo-viewer-prev { left: clamp(8px, 2vw, 24px); }
.photo-viewer-next { right: clamp(8px, 2vw, 24px); }
@media (pointer: coarse) { .photo-viewer-prev, .photo-viewer-next { display: none; } }
</style>

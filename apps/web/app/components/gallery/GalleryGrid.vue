<script setup lang="ts">
import { useElementSize, useEventListener, useWindowSize } from "@vueuse/core";
import type { GalleryPhoto } from "#shared/types/gallery";

// The whole gallery as one long grid of equal rows. Only rows near the screen are rendered, and while the page
// moves faster than anyone could look, new tiles wait to load their photos, so even a drag across thousands stays smooth.
const props = defineProps<{ photos: GalleryPhoto[]; total: number; loaded: boolean; failed: boolean }>();
const emit = defineEmits<{ retry: []; open: [index: number] }>();

const GAP = 4;
// Rows rendered past each edge of the screen, so photos are ready before they scroll in
const OVERSCAN = 3;
// Faster than this many screens a second, a photo would be gone before it loaded
const FAST = 3;

const grid = useTemplateRef("grid");
const { width } = useElementSize(grid);
const { height: screen } = useWindowSize();
// Three columns on phones, up to six on wide screens, with 4:3 tiles.
const columns = computed(() => Math.min(6, Math.max(3, Math.floor((width.value + GAP) / (220 + GAP)))));
const tileHeight = computed(() => (width.value - GAP * (columns.value - 1)) / columns.value * 3 / 4);
const rowHeight = computed(() => tileHeight.value + GAP);
// Until the photos arrive, the gallery's photo count sizes the grid, so the scrollbar is right from the start.
const count = computed(() => (props.loaded ? props.photos.length : props.total));
const rowCount = computed(() => Math.ceil(count.value / columns.value));

// Where the grid starts on the page, and how far the page is scrolled.
const top = ref(0);
const scrollY = ref(0);
const fast = ref(false);
let last = { y: 0, time: 0 };
let settle: ReturnType<typeof setTimeout> | undefined;

function onScroll() {
  const y = window.scrollY;
  // Gallery details above the grid can change without changing the grid’s width.
  if (grid.value) top.value = grid.value.getBoundingClientRect().top + y;
  const time = performance.now();
  const speed = Math.abs(y - last.y) / screen.value / Math.max(time - last.time, 1) * 1000;
  last = { y, time };
  scrollY.value = y;
  if (speed > FAST) {
    fast.value = true;
    clearTimeout(settle);
    settle = setTimeout(() => (fast.value = false), 100);
  }
}
useEventListener(window, "scroll", onScroll, { passive: true });

const measureTop = () => {
  if (grid.value) top.value = grid.value.getBoundingClientRect().top + window.scrollY;
};
onMounted(() => {
  measureTop();
  last = { y: window.scrollY, time: performance.now() };
  scrollY.value = last.y;
});
watch(width, measureTop);

// The server can't measure the page, so the grid renders empty there and fills in once the browser has it.
const firstRow = computed(() => Math.max(0, Math.floor((scrollY.value - top.value) / rowHeight.value) - OVERSCAN));
const lastRow = computed(() => Math.min(rowCount.value, Math.ceil((scrollY.value - top.value + screen.value) / rowHeight.value) + OVERSCAN));
const rows = computed(() => (width.value ? range(firstRow.value, lastRow.value) : []));
const cells = (row: number) => range(row * columns.value, Math.min((row + 1) * columns.value, count.value));

function range(from: number, to: number) {
  return Array.from({ length: Math.max(0, to - from) }, (_, offset) => from + offset);
}
</script>

<template>
  <p v-if="failed" class="status" role="alert">Couldn’t load the photos. <button type="button" @click="emit('retry')">Try again</button></p>
  <div v-else ref="grid" class="grid" :style="{ height: `${width ? Math.max(0, rowCount * rowHeight - GAP) : 0}px` }">
    <div
      v-for="row in rows"
      :key="row"
      class="row"
      :style="{ transform: `translateY(${row * rowHeight}px)`, height: `${tileHeight}px`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
    >
      <GalleryTile v-for="index in cells(row)" :key="index" :photo="photos[index]" :label="`Open photo ${index + 1}`" :wait="fast" @open="emit('open', index)" />
    </div>
  </div>
</template>

<style scoped>
/* Rows and the grid have fixed sizes, so changes inside them never lay out the rest of the page */
.grid { position: relative; width: 100%; contain: strict; }
.row { position: absolute; top: 0; left: 0; display: grid; gap: 4px; width: 100%; contain: strict; }
.status { padding: 28px; color: #8e8e89; font-size: .92rem; text-align: center; }
.status button { color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
</style>

<script setup lang="ts">
import { useWindowVirtualizer } from "@tanstack/vue-virtual";
import { useElementSize, useMounted } from "@vueuse/core";
import type { GalleryPhoto } from "#shared/types/gallery";

// The whole gallery as one long grid. Only rows near the screen are rendered, so thousands of photos stay smooth.
const props = defineProps<{ photos: GalleryPhoto[]; total: number; loading: boolean; failed: boolean; done: boolean }>();
const emit = defineEmits<{ more: []; open: [index: number] }>();

const GAP = 4;
const grid = useTemplateRef("grid");
const { width } = useElementSize(grid);
// Three columns on phones, up to six on wide screens, with 4:3 tiles.
const columns = computed(() => Math.min(6, Math.max(3, Math.floor((width.value + GAP) / (220 + GAP)))));
const tileHeight = computed(() => (width.value - GAP * (columns.value - 1)) / columns.value * 3 / 4);
// Until the last page arrives, the gallery's photo count sizes the grid, so the scrollbar is right from the start.
const count = computed(() => (props.done ? props.photos.length : Math.max(props.total, props.photos.length)));

// The virtualizer measures rows from the top of the page, so it needs to know where the grid starts.
const top = ref(0);
const measureTop = () => {
  if (grid.value) top.value = grid.value.getBoundingClientRect().top + window.scrollY;
};
onMounted(measureTop);
watch(width, measureTop);

const virtualizer = useWindowVirtualizer(computed(() => ({
  count: Math.ceil(count.value / columns.value),
  estimateSize: () => tileHeight.value + GAP,
  overscan: 4,
  scrollMargin: top.value,
})));
watch(tileHeight, () => virtualizer.value.measure());

// The server can't measure the page, so the grid renders empty there and fills in once the browser has it.
const mounted = useMounted();
const rows = computed(() => (mounted.value ? virtualizer.value.getVirtualItems() : []));
const cells = (row: number) => {
  const first = row * columns.value;
  return Array.from({ length: Math.min(columns.value, count.value - first) }, (_, offset) => first + offset);
};

// Ask for the next page while the rows on screen reach photos that haven't arrived.
watchEffect(() => {
  const last = rows.value.at(-1);
  if (last && !props.failed && (last.index + 3) * columns.value > props.photos.length) emit("more");
});
</script>

<template>
  <div ref="grid" class="grid" :style="{ height: `${mounted ? virtualizer.getTotalSize() : 0}px` }">
    <div
      v-for="row in rows"
      :key="row.key as number"
      class="row"
      :style="{ transform: `translateY(${row.start - top}px)`, height: `${tileHeight}px`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
    >
      <GalleryTile v-for="index in cells(row.index)" :key="index" :photo="photos[index]" :label="`Open photo ${index + 1}`" @open="emit('open', index)" />
    </div>
  </div>
  <p v-if="loading" class="status" role="status"><span class="spinner" aria-hidden="true" />Loading more photos</p>
  <p v-else-if="failed" class="status" role="alert">Couldn’t load more photos. <button type="button" @click="emit('more')">Try again</button></p>
</template>

<style scoped>
.grid { position: relative; width: 100%; }
.row { position: absolute; top: 0; left: 0; display: grid; gap: 4px; width: 100%; }
.status { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px; color: #8e8e89; font-size: .92rem; }
.status button { color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
.spinner { width: 18px; height: 18px; border: 2px solid #3a3a38; border-top-color: var(--brand); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { rotate: 1turn; } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2s; } }
</style>

<script setup lang="ts">
import type { GalleryPhoto } from "#shared/types/gallery";

// One cell of the gallery grid: a shimmering placeholder until its photo arrives, then the thumbnail fading in.
const props = defineProps<{ photo?: GalleryPhoto; label: string }>();
defineEmits<{ open: [] }>();

const image = useTemplateRef("image");
const loaded = ref(false);
const src = ref(props.photo?.thumb);
watch(() => props.photo?.key, () => {
  src.value = props.photo?.thumb;
  loaded.value = false;
});
// Photos the browser already has skip the fade, so scrolling back up doesn't flicker.
onMounted(() => {
  if (image.value?.complete && image.value.naturalWidth) loaded.value = true;
});

// Galleries uploaded before thumbnails existed show the full photo until the backfill has run.
function useFullPhoto() {
  if (props.photo && src.value !== props.photo.full) src.value = props.photo.full;
}
</script>

<template>
  <button v-if="photo" type="button" :class="['tile', { loaded }]" :aria-label="label" @click="$emit('open')">
    <img ref="image" :src="src" alt="" decoding="async" :class="{ loaded }" @load="loaded = true" @error="useFullPhoto">
  </button>
  <div v-else class="tile" aria-hidden="true" />
</template>

<style scoped>
.tile { position: relative; display: block; width: 100%; height: 100%; padding: 0; overflow: hidden; border: 0; cursor: zoom-in; background: linear-gradient(100deg, #222220 40%, #2c2c29 50%, #222220 60%) 0 0 / 300% 100%; animation: shimmer 1.4s linear infinite; }
.tile.loaded { animation: none; }
.tile:focus-visible { outline: 3px solid var(--brand); outline-offset: -3px; }
img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .35s ease, scale .3s ease; }
img.loaded { opacity: 1; }
.tile:hover img { scale: 1.03; }
@keyframes shimmer { to { background-position: -150% 0; } }
@media (prefers-reduced-motion: reduce) { .tile { animation: none; } img { transition: none; } }
</style>

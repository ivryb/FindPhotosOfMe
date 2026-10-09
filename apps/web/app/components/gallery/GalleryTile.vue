<script setup lang="ts">
import type { GalleryPhoto } from "#shared/types/gallery";

// One cell of a photo grid: a plain placeholder until its photo arrives, then the thumbnail fading in.
// While `wait` is set the tile doesn't ask for its photo yet; once it has asked, it keeps the photo.
const props = defineProps<{ photo?: GalleryPhoto; label: string; wait?: boolean }>();
defineEmits<{ open: [] }>();

const asked = ref(false);
watchEffect(() => {
  if (!props.wait) asked.value = true;
});
const loaded = ref(false);
// Galleries uploaded before thumbnails existed show the full photo until the backfill has run.
const full = ref(false);
// Photos the browser already has skip the fade, so scrolling back up doesn't flicker.
const image = useTemplateRef("image");
watch(image, (img) => {
  if (img?.complete && img.naturalWidth) loaded.value = true;
}, { flush: "post" });
</script>

<template>
  <button v-if="photo" type="button" class="tile" :aria-label="label" :data-photo="photo.key" @click="$emit('open')">
    <img v-if="asked" ref="image" :src="full ? photo.full : photo.thumb" alt="" decoding="async" :class="{ loaded }" @load="loaded = true" @error="full = true">
  </button>
  <div v-else class="tile" aria-hidden="true" />
</template>

<style scoped>
.tile { position: relative; display: block; width: 100%; height: 100%; padding: 0; overflow: hidden; border: 0; background: #222220; cursor: zoom-in; }
.tile:focus-visible { outline: 3px solid var(--brand); outline-offset: -3px; }
img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .35s ease, scale .3s ease; }
img.loaded { opacity: 1; }
.tile:hover img { scale: 1.03; }
@media (prefers-reduced-motion: reduce) { img { transition: none; } }
</style>

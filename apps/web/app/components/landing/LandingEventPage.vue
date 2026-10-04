<script setup lang="ts">
// The public event page attendees open, in a browser window. A brand puts a photographer's
// name and color on it; `compact` fits it into a narrower column.
withDefaults(defineProps<{
  url?: string;
  label?: string;
  brand?: { name: string; color: string };
  compact?: boolean;
}>(), {
  url: "harborsummit.findphotosofme.com",
  label: "The public page for Harbor Summit Lisbon, with preview photos and a button to find your photos.",
  compact: false,
});

const PREVIEWS = ["nx-04", "t21", "nx-07", "t24", "nx-01", "u31"];
</script>

<template>
  <div :class="['browser', { compact }]" role="img" :aria-label="label" :style="brand && { '--studio': brand.color }">
    <div class="browser-bar" aria-hidden="true"><i /><i /><i /><span>{{ url }}</span></div>
    <div v-if="brand" class="brandbar" aria-hidden="true"><span class="brandmark">{{ brand.name[0] }}</span>{{ brand.name }}</div>
    <div class="evpage" aria-hidden="true">
      <div>
        <p class="muted">May 14–15, 2026 in Lisbon</p>
        <p class="title">Harbor Summit Lisbon</p>
        <p class="muted">5,214 photos</p>
        <div class="find">
          <span class="slot" />
          <span><b>Find your photos</b><small>Add a selfie to see the photos you’re in.</small></span>
        </div>
        <span class="find-btn">Find my photos</span>
      </div>
      <figure class="mosaic">
        <img v-for="photo in PREVIEWS" :key="photo" :src="`/landing/${photo}.jpg`" alt="">
        <figcaption>Preview photos you choose</figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.browser { width: 100%; overflow: hidden; background: #fff; color: var(--foreground); border-radius: 10px; box-shadow: var(--lift); }
.browser-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #e6e6e2; color: var(--muted-foreground); font-size: .8rem; }
.browser-bar i { width: 10px; height: 10px; border-radius: 50%; background: #c9c9c4; }
.browser-bar span { flex: 1; max-width: 320px; margin-left: 10px; padding: 3px 12px; overflow: hidden; background: #fff; border-radius: 6px; text-overflow: ellipsis; white-space: nowrap; }
.brandbar { display: flex; align-items: center; gap: 10px; padding: 14px clamp(18px, 3.5vw, 44px); border-bottom: 1px solid var(--border); font-weight: 800; font-stretch: 112%; }
.brandmark { display: grid; place-items: center; width: 30px; height: 30px; background: var(--studio); color: #fff; border-radius: 50%; font-size: .9rem; transition: background-color .3s; }
.evpage { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); align-items: center; gap: clamp(20px, 3.5vw, 48px); padding: clamp(18px, 3.5vw, 44px); }
.muted { color: var(--muted-foreground); }
.title { margin: 8px 0 6px; font-size: clamp(1.7rem, 3.4vw, 2.7rem); font-weight: 800; font-stretch: 116%; letter-spacing: -.03em; line-height: 1; }
.find { display: flex; align-items: center; gap: 14px; margin-top: clamp(20px, 2.5vw, 32px); padding: 14px; border: 2px dashed #c2c2bd; border-radius: 10px; line-height: 1.3; }
.slot { flex: none; width: 52px; height: 52px; border: 2px dashed #c2c2bd; border-radius: 50%; }
.find b, .find small { display: block; }
.find small { color: var(--muted-foreground); font-size: .9rem; }
.find-btn { display: grid; place-items: center; height: 56px; margin-top: 12px; background: var(--studio, var(--foreground)); color: #fff; border-radius: 6px; font-weight: 700; font-stretch: 110%; transition: background-color .3s; }
.mosaic { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.mosaic img { width: 100%; height: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; }
.mosaic img:first-child { grid-column: span 2; grid-row: span 2; }
.mosaic figcaption { grid-column: 1 / -1; color: var(--muted-foreground); font-size: .85rem; }
/* In a narrower column both halves share the width, and the title shrinks */
.compact .evpage { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.compact .title { font-size: clamp(1.4rem, 2.4vw, 1.9rem); }
.compact figcaption { display: none; }
@media (max-width: 760px) { .evpage, .compact .evpage { grid-template-columns: 1fr; } .mosaic { order: -1; } }
</style>

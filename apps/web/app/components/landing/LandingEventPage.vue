<script setup lang="ts">
import { Camera } from "@lucide/vue";

// The public gallery page attendees open, in a browser window: the name and photos on ink,
// with the yellow selfie search floating over them, as on the real page.
withDefaults(defineProps<{ url?: string; label?: string }>(), {
  url: "makersconf.findphotosofme.com",
  label: "The gallery page for Makers Conf 2026: 5,214 photos in a grid, with a yellow bar at the bottom to search them with a selfie.",
});

const PHOTOS = [
  "nx-01", "t08", "nx-04", "t11", "nx-07", "t20",
  "t05", "nx-02", "t17", "nx-05", "p09", "nx-03",
  "t24", "nx-06", "t30", "u31", "nx-08", "t16",
];
</script>

<template>
  <div class="browser" role="img" :aria-label="label">
    <div class="browser-bar" aria-hidden="true"><i /><i /><i /><span>{{ url }}</span></div>
    <div class="page" aria-hidden="true">
      <p class="logo"><img src="/icon.svg" alt="">FindPhotosOfMe</p>
      <p class="title">Makers Conf 2026</p>
      <p class="count">5,214 photos</p>
      <div class="grid">
        <img v-for="photo in PHOTOS" :key="photo" :src="`/landing/${photo}.jpg`" alt="" loading="lazy">
      </div>
      <div class="banner">
        <span class="slot"><Camera /></span>
        <span class="banner-text"><b>Find photos with you</b><small>Upload a photo of your face to see only photos you’re in.</small></span>
        <span class="banner-button"><Camera /><span class="wide-only">Search with a selfie</span><span class="narrow-only">Search</span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browser { width: 100%; overflow: hidden; background: var(--foreground); color: var(--background); border-radius: 10px; box-shadow: var(--lift); }
.browser-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #e6e6e2; color: var(--muted-foreground); font-size: .8rem; }
.browser-bar i { width: 10px; height: 10px; border-radius: 50%; background: #c9c9c4; }
.browser-bar span { flex: 1; max-width: 320px; margin-left: 10px; padding: 3px 12px; overflow: hidden; background: #fff; border-radius: 6px; text-overflow: ellipsis; white-space: nowrap; }

.page { position: relative; padding: 0 clamp(4px, 1vw, 10px); }
.logo, .title, .count { padding-inline: clamp(14px, 3vw, 36px); }
.logo { display: flex; align-items: center; gap: 8px; padding-block: 16px; font-size: .85rem; font-weight: 900; font-stretch: 118%; letter-spacing: -.02em; }
.logo img { width: 22px; height: 22px; }
.title { margin-top: clamp(4px, 1.5vw, 16px); font-size: clamp(1.8rem, 4.6vw, 3.8rem); font-weight: 800; font-stretch: 118%; letter-spacing: -.03em; line-height: 1; }
.count { margin: 12px 0 clamp(18px, 2.5vw, 28px); font-size: .9rem; font-weight: 800; font-stretch: 112%; }

/* Three rows of the gallery, fading out under the search bar */
.grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 3px; }
.grid img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.page::after { content: ""; position: absolute; inset: auto 0 0; height: 45%; background: linear-gradient(transparent, rgb(21 21 21 / .85)); pointer-events: none; }

.banner { position: absolute; bottom: clamp(10px, 2vw, 20px); left: 50%; z-index: 1; display: flex; align-items: center; gap: 12px; width: min(700px, calc(100% - 20px)); padding: 9px; background: var(--brand); color: var(--brand-foreground); border-radius: 14px; box-shadow: 0 20px 40px -14px rgb(0 0 0 / .8); translate: -50% 0; text-align: left; }
.slot { display: grid; flex: none; place-items: center; width: 48px; height: 48px; border: 2px dashed rgb(21 21 21 / .4); border-radius: 50%; }
.slot svg { width: 20px; height: 20px; }
.banner-text { flex: 1; min-width: 0; line-height: 1.3; }
.banner-text b { display: block; font-weight: 800; font-stretch: 112%; }
.banner-text small { display: block; overflow: hidden; color: #4f4826; font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
.banner-button { display: flex; flex: none; align-items: center; gap: 8px; height: 44px; padding-inline: 16px; background: var(--foreground); color: var(--background); border-radius: 8px; font-size: .9rem; font-weight: 700; font-stretch: 110%; }
.banner-button svg { width: 16px; height: 16px; }
.narrow-only { display: none; }

@media (max-width: 760px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid img:nth-child(n + 13) { display: none; }
  .slot, .banner-text small, .wide-only { display: none; }
  .narrow-only { display: inline; }
  .banner-text { padding-left: 6px; }
}
</style>

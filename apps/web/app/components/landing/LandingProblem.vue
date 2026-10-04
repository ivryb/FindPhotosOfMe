<script setup lang="ts">
import { useElementSize } from "@vueuse/core";

// "Ever scrolled through hundreds of photos": a viewer that flips through the folder on its own,
// with a strip of thumbnails sliding under a fixed yellow frame.
const PHOTOS = ["p03", "nx-01", "p09", "nx-03", "p11", "nx-08", "p16", "nx-02", "p20", "nx-05", "p26", "nx-07", "p30", "nx-04", "p02", "nx-06"];
const FOLDER_START = 247;
const FOLDER_SIZE = 5214;
const THUMB = 92;
const GAP = 6;

// Three copies of the photos, starting in the middle one, so the strip is full on both sides.
// When it reaches the last copy, it jumps back to the same photo in the middle copy without animating.
const thumbs = [...PHOTOS, ...PHOTOS, ...PHOTOS];
const at = ref(PHOTOS.length);
const steps = ref(0);
const animate = ref(true);

const strip = useTemplateRef("strip");
const { width: stripWidth } = useElementSize(strip);
const trackOffset = computed(() => stripWidth.value / 2 - (at.value * (THUMB + GAP) + THUMB / 2));
const photo = computed(() => thumbs[at.value]!);
const counter = computed(() => `Photo ${formatCount(FOLDER_START + steps.value)} of ${formatCount(FOLDER_SIZE)}`);

const viewer = useTemplateRef("viewer");
useLoopOnView(viewer, 1300, () => {
  animate.value = true;
  steps.value++;
  at.value++;
  if (at.value === PHOTOS.length * 2) {
    setTimeout(() => {
      animate.value = false;
      at.value = PHOTOS.length;
    }, 600);
  }
});
</script>

<template>
  <LandingSection id="problem">
    <LandingHeadRow
      centered
      title="Ever scrolled through hundreds of photos looking for yourself?"
      text="The event is over. Someone shares a folder of photos. You open it, hoping to find the ones you’re in. But there are hundreds to look through, and it’s easy to miss a good one."
    />
    <figure ref="viewer" class="viewer" aria-label="A photo viewer flipping through the event folder one photo at a time">
      <div class="viewer-bar"><b>Event photos</b><span class="viewer-count">{{ counter }}</span></div>
      <img class="viewer-photo" :src="`/landing/${photo}.jpg`" alt="">
      <div ref="strip" class="viewer-strip" aria-hidden="true">
        <div class="viewer-track" :style="{ translate: `${trackOffset}px 0`, transition: animate ? undefined : 'none' }">
          <img v-for="(src, i) in thumbs" :key="i" :src="`/landing/${src}.jpg`" alt="" loading="lazy">
        </div>
      </div>
      <figcaption>“I know I’m in here somewhere.”</figcaption>
    </figure>
  </LandingSection>
</template>

<style scoped>
.viewer { max-width: 940px; margin: 0 auto; padding: clamp(10px, 1.2vw, 14px); background: var(--foreground); color: var(--background); border-radius: 12px; box-shadow: 0 40px 70px -40px rgb(0 0 0 / .6); }
.viewer-bar { display: flex; justify-content: space-between; gap: 12px; padding: 2px 6px 12px; font-size: .9rem; }
.viewer-count { color: #b8b8b2; font-variant-numeric: tabular-nums; }
.viewer-photo { width: 100%; aspect-ratio: 2 / 1; object-fit: cover; border-radius: 4px; }
.viewer-strip { position: relative; margin-top: 10px; overflow: hidden; }
.viewer-strip::after { content: ""; position: absolute; top: 0; left: 50%; width: 92px; height: 100%; translate: -50% 0; border: 3px solid var(--brand); border-radius: 4px; }
.viewer-track { display: flex; gap: 6px; transition: translate .5s cubic-bezier(.3, .8, .2, 1); }
.viewer-track img { flex: none; width: 92px; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 4px; opacity: .55; }
figcaption { padding: 16px 6px 4px; font-size: 1.05rem; font-weight: 700; text-align: center; }
@media (prefers-reduced-motion: reduce) { .viewer-track { transition: none; } }
</style>

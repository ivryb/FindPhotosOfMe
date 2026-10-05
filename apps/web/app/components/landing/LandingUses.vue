<script setup lang="ts">
import { ScanFace } from "@lucide/vue";

const USES = [
  { who: "each guest", pile: "your wedding album" },
  { who: "your grandmother", pile: "years of family photos" },
  { who: "your kid", pile: "a whole football season" },
  { who: "each friend", pile: "the photos from your trip" },
] as const;
</script>

<template>
  <LandingSection id="uses" class="uses" aria-label="People you can find in your photos">
    <ul class="ribbons">
      <li v-for="use in USES" :key="use.who">
        Find <span class="person"><ScanFace aria-hidden="true" /><span>{{ use.who }}</span></span><span class="collection"> in {{ use.pile }}</span>
      </li>
    </ul>
  </LandingSection>
</template>

<style scoped>
.uses { padding-block: clamp(80px, 10vw, 136px); }
.ribbons { display: grid; justify-items: center; gap: 40px; text-align: center; }
.ribbons li { max-width: 100%; font-size: clamp(22px, 2.8vw, 35px); font-weight: 800; font-stretch: 112%; letter-spacing: -.035em; line-height: 1.45; text-wrap: balance; }
.person { display: inline-flex; align-items: center; gap: .24em; max-width: 100%; padding: .03em .3em .09em; border-radius: .23em; background: #151515; color: #ffd21f; line-height: 1.15; vertical-align: baseline; }
.person svg { flex: none; width: .8em; height: .8em; stroke-width: 2.3; }
@media (max-width: 700px) {
  .ribbons { gap: 36px; }
  .ribbons li { font-size: clamp(18px, 5.5vw, 24px); }
  .collection { display: block; }
}
</style>

<script setup lang="ts">
// A studio's gallery settings next to the gallery they produce; picking a color recolors the preview.
const SWATCHES = [
  { name: "Green", color: "#1f5c4a" },
  { name: "Blue", color: "#2448c8" },
  { name: "Red", color: "#b4372f" },
  { name: "Purple", color: "#7b3fa0" },
  { name: "Black", color: "#151515" },
];
const color = ref(SWATCHES[0]!.color);
const brand = computed(() => ({ name: "Lumen Studio", color: color.value }));
</script>

<template>
  <LandingSection id="branding" tone="grey">
    <LandingHeadRow
      title="Your name on every gallery"
      text="Add your studio name, logo, and color once. Every gallery you publish uses them, so guests know whose photos they’re looking at."
    />
    <div class="demo">
      <div class="panel">
        <h3>Gallery branding</h3>
        <p class="label">Studio name</p>
        <p class="field">Lumen Studio</p>
        <p class="label">Logo</p>
        <p class="field"><span class="mark" :style="{ background: color }">L</span>lumen-logo.png</p>
        <p id="brand-color" class="label">Color</p>
        <div class="swatches" role="group" aria-labelledby="brand-color">
          <button
            v-for="swatch in SWATCHES"
            :key="swatch.color"
            type="button"
            :style="{ background: swatch.color }"
            :aria-label="swatch.name"
            :aria-pressed="color === swatch.color"
            @click="color = swatch.color"
          />
        </div>
      </div>
      <LandingEventPage compact url="lumenstudio.findphotosofme.com" label="The gallery preview in the chosen brand color." :brand="brand" />
    </div>
  </LandingSection>
</template>

<style scoped>
.demo { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); align-items: center; gap: clamp(24px, 4vw, 48px); }
.panel { padding: clamp(20px, 2.5vw, 28px); background: #fff; border-radius: 12px; box-shadow: var(--lift); }
.panel h3 { padding-bottom: 14px; border-bottom: 2px solid var(--foreground); font-size: 1.1rem; }
.label { margin: 18px 0 8px; font-size: .95rem; font-weight: 700; }
.field { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; }
.mark { display: grid; place-items: center; width: 30px; height: 30px; color: #fff; border-radius: 50%; font-size: .9rem; font-weight: 800; transition: background-color .3s; }
.swatches { display: flex; flex-wrap: wrap; gap: 10px; }
.swatches button { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; }
.swatches button[aria-pressed="true"] { box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--foreground); }
@media (max-width: 860px) { .demo { grid-template-columns: 1fr; } }
</style>

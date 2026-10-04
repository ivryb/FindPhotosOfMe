<script setup lang="ts">
import { useIntersectionObserver, useMediaQuery, useMounted } from "@vueuse/core";

// One person's search through a pile of photos, on a loop while it's on screen.
// The wording follows the page: a conference pile by default, any pile on the personal page.
const props = withDefaults(defineProps<{
  label: string;
  pile?: string;
  addFace?: string;
  face?: string;
  looking?: string;
  found?: string;
}>(), {
  pile: "Event photos",
  addFace: "Add your photo",
  face: "Your photo",
  looking: "Looking for your photos",
  found: "photos of you",
});

const TOTAL = 5214;
const MATCHES = ["ev-01", "ev-02", "ev-03", "ev-04", "ev-05", "ev-06", "ev-07", "ev-08"];
const OTHERS = ["nx-01", "nx-02", "nx-03", "nx-04", "nx-05", "nx-06", "nx-07", "nx-08", "t01", "u03", "t04", "t05", "u04", "t06", "t07", "u05", "t08", "t10", "u06", "t12", "t13", "u08", "t14", "t15", "u13", "t17", "t18", "u14", "t19", "t21", "u29", "t22", "t24", "u31", "t25", "t27", "u32", "t28", "t29", "u33", "t31", "t34"];
// Match positions are spread across the grid; on narrow screens the grid is smaller, so they get their own slots.
const LAYOUTS = {
  wide: { cols: 10, rows: 5, slots: [3, 8, 14, 21, 26, 32, 37, 45], resultCols: 4 },
  narrow: { cols: 4, rows: 6, slots: [1, 6, 8, 11, 14, 17, 19, 22], resultCols: 2 },
};
const STEPS = [
  { state: "idle", ms: 1400 },
  { state: "selfie", ms: 1200 },
  { state: "scan", ms: 3700 },
  { state: "found", ms: 4600 },
] as const;
type State = (typeof STEPS)[number]["state"];

const narrow = useMediaQuery("(max-width: 700px)");
const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
// The server can't know the screen width, so the photos are laid out once the page is in the browser;
// hydrating a different number of tiles than the server rendered would mismatch.
const mounted = useMounted();
const layout = computed(() => (mounted.value && narrow.value ? LAYOUTS.narrow : LAYOUTS.wide));

// Every grid slot holds one photo; the matches also know where they land in the result grid.
const tiles = computed(() => {
  if (!mounted.value) return [];
  const { cols, rows, slots, resultCols } = layout.value;
  const resultRows = MATCHES.length / resultCols;
  let other = 0;
  return Array.from({ length: cols * rows }, (_, slot) => {
    const k = slots.indexOf(slot);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const style: Record<string, string | number> = {
      "--x": `${(col * 100) / cols}%`, "--y": `${(row * 100) / rows}%`,
      "--w": `${100 / cols}%`, "--h": `${100 / rows}%`, "--sx": col / (cols - 1),
    };
    if (k < 0) return { src: OTHERS[other++]!, match: false, style };
    Object.assign(style, {
      "--k": k,
      "--rx": `${((k % resultCols) * 100) / resultCols}%`, "--ry": `${(Math.floor(k / resultCols) * 100) / resultRows}%`,
      "--rw": `${100 / resultCols}%`, "--rh": `${100 / resultRows}%`,
    });
    return { src: MATCHES[k]!, match: true, style };
  });
});

const state = ref<State>("idle");
const checked = useCountUp();
const title = computed(() => ({
  idle: props.pile,
  selfie: props.pile,
  scan: props.looking,
  found: `${MATCHES.length} ${props.found}`,
}[state.value]));
const subtitle = computed(() => ({
  idle: `${formatCount(TOTAL)} photos`,
  selfie: `${formatCount(TOTAL)} photos`,
  scan: `${formatCount(checked.count.value)} of ${formatCount(TOTAL)} photos checked`,
  found: `out of ${formatCount(TOTAL)}`,
}[state.value]));

watch(state, (next) => {
  if (next === "scan") checked.countTo(TOTAL, 3100);
});

const demo = useTemplateRef("demo");
let step = -1;
let timer: ReturnType<typeof setTimeout> | undefined;
function advance() {
  step = (step + 1) % STEPS.length;
  state.value = STEPS[step]!.state;
  timer = setTimeout(advance, STEPS[step]!.ms);
}
useIntersectionObserver(demo, ([entry]) => {
  clearTimeout(timer);
  if (reducedMotion.value) state.value = "found";
  else if (entry?.isIntersecting) timer = setTimeout(advance, 500);
}, { threshold: 0.3 });
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div>
    <div ref="demo" class="search" :data-state="state" role="img" :aria-label="label">
      <div class="search-bar" aria-hidden="true">
        <p><span class="search-label">{{ title }}</span><span class="search-count">{{ subtitle }}</span></p>
        <div class="search-face">
          <span>{{ state === "idle" ? addFace : face }}</span>
          <i class="search-slot"><img src="/landing/face.jpg" alt=""></i>
        </div>
      </div>
      <div class="search-grid" aria-hidden="true" :style="{ aspectRatio: `${layout.cols * 4} / ${layout.rows * 3}` }">
        <div v-for="tile in tiles" :key="tile.src" :class="['search-tile', { match: tile.match }]" :style="tile.style">
          <img :src="`/landing/${tile.src}.jpg`" alt="">
        </div>
      </div>
    </div>
    <p class="demo-note">Example search with sample photos and counts.</p>
  </div>
</template>

<style scoped>
/* data-state drives the look: idle → selfie → scan → found */
.search { padding: clamp(8px, 1.2vw, 14px); background: var(--foreground); color: var(--background); border-radius: 12px; box-shadow: 0 40px 70px -40px rgb(0 0 0 / .6); }
.search-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; padding: 0 6px clamp(8px, 1vw, 12px); line-height: 1.25; }
.search-label { display: block; font-size: clamp(1rem, 1.6vw, 1.2rem); font-weight: 800; font-stretch: 110%; }
.search-count { display: block; color: #b8b8b2; font-size: .9rem; }
.search-face { display: flex; align-items: center; gap: 10px; color: #b8b8b2; font-size: .9rem; font-weight: 600; }
.search-slot { flex: none; width: 46px; height: 46px; overflow: hidden; border: 2px dashed #6c6c68; border-radius: 50%; transition: border-color .3s; }
.search-slot img { width: 100%; height: 100%; object-fit: cover; scale: 0; transition: scale .45s cubic-bezier(.2, .9, .3, 1.3); }
.search:not([data-state="idle"]) .search-slot { border: 3px solid var(--brand); }
.search:not([data-state="idle"]) .search-slot img { scale: 1; }
.search-grid { position: relative; overflow: hidden; }
.search-tile { position: absolute; left: var(--x); top: var(--y); width: var(--w); height: var(--h); padding: clamp(2px, .3vw, 4px); transition: left .8s, top .8s, width .8s, height .8s, opacity .45s, scale .45s; transition-timing-function: cubic-bezier(.3, .8, .2, 1); }
.search-tile img { width: 100%; height: 100%; object-fit: cover; border-radius: 3px; }
.search-tile::after { content: ""; position: absolute; inset: clamp(2px, .3vw, 4px); border: 3px solid var(--brand); border-radius: 3px; opacity: 0; transition: opacity .3s; }
.search-grid::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 90px; margin-left: -90px; background: linear-gradient(90deg, transparent, rgb(255 210 31 / .3)); border-right: 3px solid var(--brand); opacity: 0; pointer-events: none; }
/* the scan line crosses in 3s; each tile settles as the line passes its column (--sx = 0..1) */
[data-state="scan"] .search-grid::after { animation: search-sweep 3s linear .1s both; }
[data-state="scan"] .search-tile:not(.match) { opacity: .22; transition-delay: calc(var(--sx) * 3s + .1s); }
[data-state="scan"] .match::after { opacity: 1; transition-delay: calc(var(--sx) * 3s + .1s); }
[data-state="found"] .search-tile:not(.match) { opacity: 0; scale: .8; }
[data-state="found"] .match { left: var(--rx); top: var(--ry); width: var(--rw); height: var(--rh); transition-delay: calc(var(--k) * 50ms); }
[data-state="found"] .match::after { opacity: 1; }
@keyframes search-sweep { 0% { left: 0; opacity: 1; } 96% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
.demo-note { margin-top: 16px; color: var(--muted-foreground); font-size: .85rem; text-align: center; }
@media (max-width: 700px) { .search-face span { display: none; } }
@media (prefers-reduced-motion: reduce) {
  .search-tile, .search-tile::after, .search-slot img { transition: none; }
  .search-grid::after { animation: none; }
}
</style>

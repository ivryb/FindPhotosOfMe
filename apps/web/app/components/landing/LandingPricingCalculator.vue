<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { LIMITS, MINIMUM_PAYMENT, clampCount, count, estimatePrice, money, type Usage } from "@/utils/pricing";

const id = useId();
const photos = ref(2_000);
const searches = ref(300);
const days = ref<Usage["days"]>(30);
const price = computed(() => estimatePrice({ photos: photos.value, searches: searches.value, days: days.value }));
const progress = (value: number, kind: keyof typeof LIMITS) => `${(value - LIMITS[kind].min) / (LIMITS[kind].max - LIMITS[kind].min) * 100}%`;

// One tile per 100 photos, so a full sheet is the 20,000-photo limit.
const columns = 25;
const tiles = LIMITS.photos.max / LIMITS.photos.step;
const filled = computed(() => photos.value / LIMITS.photos.step);

// Clicking or dragging across the sheet sets the photo count; the slider covers keyboard use.
function pick(event: PointerEvent) {
  if (event.type === "pointermove" && !event.buttons) return;
  if (!(event.currentTarget instanceof HTMLElement)) return;
  const box = event.currentTarget.getBoundingClientRect();
  const rows = tiles / columns;
  const column = Math.min(columns - 1, Math.max(0, Math.floor((event.clientX - box.left) / box.width * columns)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((event.clientY - box.top) / box.height * rows)));
  photos.value = clampCount((row * columns + column + 1) * LIMITS.photos.step, "photos");
}

function setCount(event: Event, kind: keyof typeof LIMITS) {
  if (!(event.target instanceof HTMLInputElement)) return;
  const target = kind === "photos" ? photos : searches;
  if (Number.isFinite(event.target.valueAsNumber)) target.value = clampCount(event.target.valueAsNumber, kind);
  event.target.value = String(target.value);
}
</script>

<template>
  <div class="tray">
    <div class="controls">
      <div>
        <div class="field">
          <label :for="`${id}-photos`">Photos to upload</label>
          <input :id="`${id}-photos`" :value="photos" type="number" :min="LIMITS.photos.min" :max="LIMITS.photos.max" :step="LIMITS.photos.step" inputmode="numeric" @change="setCount($event, 'photos')" />
        </div>
        <input v-model.number="photos" type="range" :min="LIMITS.photos.min" :max="LIMITS.photos.max" :step="LIMITS.photos.step" aria-label="Photos to upload slider" :aria-valuetext="`${count.format(photos)} photos`" :style="{ '--progress': progress(photos, 'photos') }" />
        <p class="help">$5 per 1,000 photos.</p>
      </div>

      <div>
        <div class="field">
          <label :for="`${id}-searches`">Selfie searches</label>
          <input :id="`${id}-searches`" :value="searches" type="number" :min="LIMITS.searches.min" :max="LIMITS.searches.max" :step="LIMITS.searches.step" inputmode="numeric" @change="setCount($event, 'searches')" />
        </div>
        <input v-model.number="searches" type="range" :min="LIMITS.searches.min" :max="LIMITS.searches.max" :step="LIMITS.searches.step" aria-label="Selfie searches slider" :aria-valuetext="`${count.format(searches)} searches`" :style="{ '--progress': progress(searches, 'searches') }" />
        <p class="help">$1.50 per 100 searches. Each selfie someone checks against your photos is one search.</p>
      </div>

      <fieldset>
        <legend>Keep photos online for</legend>
        <div class="days">
          <label v-for="option in [30, 90] as const" :key="option">
            <input v-model="days" type="radio" :name="`${id}-days`" :value="option" />
            <span>{{ option }} days</span>
          </label>
        </div>
        <p class="help">The first 30 days are included. Each extra 30 days is $0.10 per GB.</p>
      </fieldset>
    </div>

    <div class="slip">
      <div class="sheet" aria-hidden="true" :style="{ '--columns': columns }" @pointerdown="pick" @pointermove="pick">
        <span v-for="n in tiles" :key="n" :class="{ on: n <= filled }" />
      </div>
      <p class="sheet-caption">Each tile is 100 photos</p>

      <p class="slip-title">You pay once</p>
      <output class="total" aria-live="polite" aria-atomic="true" aria-label="Estimated total">{{ money.format(price.total) }}</output>
      <dl class="lines">
        <div><dt>{{ count.format(photos) }} photos</dt><dd>{{ money.format(price.photoCost) }}</dd></div>
        <div><dt>{{ count.format(searches) }} searches</dt><dd>{{ money.format(price.searchCost) }}</dd></div>
        <div><dt>{{ days }} days of storage</dt><dd>{{ price.storageCost === 0 ? 'Included' : money.format(price.storageCost) }}</dd></div>
        <div v-if="price.subtotal < MINIMUM_PAYMENT" class="minimum"><dt>Topped up to the $10 minimum</dt><dd>{{ money.format(MINIMUM_PAYMENT - price.subtotal) }}</dd></div>
      </dl>
      <Button as-child size="xl" class="w-full">
        <NuxtLink to="/admin">Try 500 photos free</NuxtLink>
      </Button>
      <p class="trial">Free for 7 days with 50 searches. No card needed.</p>
    </div>
  </div>
</template>

<style scoped>

/* Ink controls beside a yellow price slip; the rules below read these colors. */
.tray { --soft: #b3b3ad; --field: #2a2a28; --track: #3a3a38; --slip-soft: #4f4826; --tile: rgb(21 21 21 / .13); --rule: rgb(21 21 21 / .25); }
.tray { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; padding: 12px; background: var(--foreground); color: var(--background); border-radius: 24px; text-align: left; }
.tray :deep(:focus-visible) { outline-color: currentColor; }
.controls { display: flex; flex-direction: column; gap: 36px; padding: clamp(16px, 3vw, 36px); }
.field { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.field label, legend { font-weight: 650; }
input[type="number"] { width: 104px; padding: 6px 12px; background: var(--field); color: var(--background); border: 0; border-radius: 999px; font: inherit; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }

input[type="range"] { display: block; width: 100%; height: 28px; margin: 0; appearance: none; background: transparent; cursor: pointer; }
input[type="range"]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--brand) var(--progress), var(--track) var(--progress)); }
input[type="range"]::-moz-range-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--brand) var(--progress), var(--track) var(--progress)); }
input[type="range"]::-webkit-slider-thumb { width: 24px; height: 24px; margin-top: -9px; appearance: none; border: 2px solid var(--brand); border-radius: 50%; background: var(--brand); }
input[type="range"]::-moz-range-thumb { width: 20px; height: 20px; border: 2px solid var(--brand); border-radius: 50%; background: var(--brand); }
.help { margin-top: 8px; color: var(--soft); font-size: .85rem; }

.days { display: flex; gap: 8px; margin-top: 14px; }
.days label { position: relative; cursor: pointer; }
.days input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.days span { display: block; padding: 8px 20px; background: var(--field); border-radius: 999px; font-weight: 650; }
.days input:checked + span { background: var(--brand); color: var(--foreground); }
.days input:focus-visible + span { outline: 3px solid currentColor; outline-offset: 2px; }

.slip { display: flex; flex-direction: column; padding: clamp(24px, 3vw, 36px); background: var(--brand); color: var(--foreground); border-radius: 16px; }
.sheet { display: grid; grid-template-columns: repeat(var(--columns), 1fr); gap: 3px; cursor: crosshair; touch-action: pan-y; user-select: none; }
.sheet span { aspect-ratio: 3 / 2; background: var(--tile); border-radius: 2px; }
.sheet span.on { background: var(--foreground); }
.sheet-caption { margin: 8px 0 28px; color: var(--slip-soft); font-size: .8rem; }
.slip-title { font-weight: 650; }
.total { display: block; margin: 4px 0 20px; font-size: clamp(3.2rem, 5.6vw, 4.6rem); font-weight: 850; font-stretch: 118%; letter-spacing: -.05em; line-height: 1.05; font-variant-numeric: tabular-nums; }
.lines { margin-bottom: 28px; }
.lines > div { display: flex; justify-content: space-between; gap: 16px; padding-block: 10px; border-top: 1px dashed var(--rule); font-variant-numeric: tabular-nums; }
.lines dd { font-weight: 650; }
.lines .minimum { color: var(--slip-soft); font-size: .85rem; }
.slip :deep(a) { margin-top: auto; }
.trial { margin-top: 10px; color: var(--slip-soft); font-size: .8rem; text-align: center; }

@media (max-width: 820px) {
  .tray { grid-template-columns: minmax(0, 1fr); }
  .sheet { gap: 2px; }
}
</style>

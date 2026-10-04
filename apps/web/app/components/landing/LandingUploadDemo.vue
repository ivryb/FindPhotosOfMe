<script setup lang="ts">
// A pile of photos is dragged in, uploaded, and their faces found: idle → drag → upload → faces → ready.
withDefaults(defineProps<{ name?: string }>(), { name: "Harbor Summit Lisbon" });

// Photos with their faces, detected by Apple Vision: [photo, ...faces as [center x %, center y %, width %]]
const UPLOADED: [string, ...[number, number, number][]][] = [
  ["ev-01", [85, 32, 9], [67, 38, 9], [43, 42, 11], [97, 34, 7], [12, 51, 16], [29, 27, 7], [15, 33, 8], [2, 25, 6], [53, 27, 6]],
  ["nx-05", [20, 36, 10], [78, 41, 10], [37, 28, 11], [58, 27, 11]],
  ["ev-03", [11, 35, 11], [84, 37, 10], [22, 29, 9], [51, 29, 11]],
  ["nx-06", [22, 31, 7], [43, 29, 9], [13, 22, 8], [91, 31, 5], [61, 24, 10], [29, 25, 4]],
  ["ev-04", [9, 57, 5], [77, 58, 5], [23, 55, 5], [26, 16, 4], [66, 57, 5], [32, 31, 4], [51, 56, 6], [64, 19, 4], [13, 32, 5], [16, 16, 5], [81, 34, 4], [90, 32, 5], [90, 58, 5], [83, 15, 4], [71, 32, 5], [46, 15, 4], [22, 33, 4], [55, 18, 4], [61, 34, 4], [51, 32, 5], [74, 18, 4]],
  ["nx-02", [36, 29, 11], [70, 21, 10], [5, 32, 4]],
  ["ev-02", [50, 30, 14], [22, 33, 11], [86, 27, 11]],
  ["nx-08", [63, 40, 7], [39, 28, 7], [55, 33, 4], [74, 27, 8], [8, 30, 4], [13, 28, 3], [29, 40, 7]],
  ["ev-08", [49, 32, 10], [7, 76, 18], [79, 28, 8], [95, 33, 5], [27, 31, 7], [59, 17, 5]],
  ["nx-03", [50, 24, 7], [16, 22, 8], [84, 24, 6]],
  ["ev-05", [43, 24, 14], [93, 59, 11], [74, 62, 12], [69, 45, 8], [4, 50, 8], [22, 48, 9], [86, 45, 6], [64, 44, 6]],
  ["ev-07", [46, 23, 12], [23, 13, 7], [30, 26, 9], [8, 15, 5]],
];
const PHOTOS = 5214;
const FACES = 11872;
const LABELS = { idle: "Waiting for photos", drag: "Waiting for photos", upload: "Uploading photos", faces: "Finding faces", ready: "✓ Ready to search" };

const mock = useTemplateRef("mock");
const phase = usePhasesOnView(mock, [["idle", 500], ["drag", 1300], ["upload", 2700], ["faces", 2500], ["ready", 0]] as const);
const photos = useCountUp();
const faces = useCountUp();

watch(phase, (next) => {
  if (next === "upload") photos.countTo(PHOTOS, 2400);
  else photos.set(next === "faces" || next === "ready" ? PHOTOS : 0);
  if (next === "faces") faces.countTo(FACES, 2200);
  else faces.set(next === "ready" ? FACES : 0);
});
const showFaces = computed(() => phase.value === "faces" || phase.value === "ready");
</script>

<template>
  <div ref="mock" class="mock upload" :data-phase="phase">
    <div class="upload-head"><b>{{ name }}</b><span class="muted">{{ formatCount(photos.count.value) }} photos</span></div>
    <div class="upload-zone">
      <p class="upload-hint">Drop ZIP files here</p>
      <div class="upload-tiles">
        <i v-for="([photo, ...boxes], i) in UPLOADED" :key="photo" :style="{ '--i': i }">
          <img :src="`/landing/${photo}.jpg`" alt="">
          <b v-for="([x, y, w], j) in boxes" :key="j" :style="{ left: `${x}%`, top: `${y}%`, width: `${w}%` }" />
        </i>
      </div>
      <div class="upload-drag">
        <img src="/landing/t08.jpg" alt=""><img src="/landing/u06.jpg" alt=""><img src="/landing/t13.jpg" alt="">
        <span class="upload-badge">5,214</span>
        <svg class="upload-cursor" viewBox="0 0 16 22" aria-hidden="true"><path d="M1 1v16.5l4.2-4 2.8 6.6 2.6-1.1-2.8-6.5H14z" fill="#151515" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" /></svg>
      </div>
    </div>
    <p class="upload-status"><span class="upload-label">{{ LABELS[phase] }}</span><span class="muted">{{ showFaces ? `${formatCount(faces.count.value)} faces` : "" }}</span></p>
    <span class="upload-progress"><i /></span>
  </div>
</template>

<style scoped>
.mock { width: 100%; max-width: 440px; padding: clamp(16px, 2.4vw, 24px); background: #fff; color: var(--foreground); box-shadow: var(--lift); font-size: .95rem; line-height: 1.35; }
.muted { color: var(--muted-foreground); }
.upload-head { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 2px solid var(--foreground); }
.upload-head b { font-weight: 800; font-stretch: 110%; }
.upload-zone { position: relative; margin-top: 14px; padding: 6px; border: 2px dashed #c2c2bd; border-radius: 6px; transition: border-color .3s, background-color .3s; }
.upload[data-phase="drag"] .upload-zone { border-color: var(--foreground); background: #fff7d1; }
.upload:is([data-phase="upload"], [data-phase="faces"], [data-phase="ready"]) .upload-zone { border-color: transparent; }
.upload-hint { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted-foreground); font-weight: 600; transition: opacity .2s; }
.upload:is([data-phase="upload"], [data-phase="faces"], [data-phase="ready"]) .upload-hint { opacity: 0; }
.upload-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.upload-tiles i { position: relative; aspect-ratio: 3 / 2; opacity: 0; scale: .6; transition: opacity .25s, scale .35s cubic-bezier(.2, .9, .3, 1.3); }
.upload-tiles img { width: 100%; height: 100%; object-fit: cover; border-radius: 2px; }
.upload-tiles b { position: absolute; min-width: 6px; aspect-ratio: 1; translate: -50% -50%; border: clamp(1px, .18vw, 2px) solid var(--brand); border-radius: 2px; opacity: 0; scale: 1.8; transition: opacity .2s, scale .3s; }
.upload:is([data-phase="upload"], [data-phase="faces"], [data-phase="ready"]) .upload-tiles i { opacity: 1; scale: 1; transition-delay: calc(var(--i) * 180ms + .15s); }
.upload:is([data-phase="faces"], [data-phase="ready"]) .upload-tiles b { opacity: 1; scale: 1; transition-delay: calc(var(--i) * 170ms); }
.upload-drag { position: absolute; left: 30%; top: 22%; width: 40%; aspect-ratio: 4 / 3; translate: 130% -120%; rotate: 12deg; opacity: 0; transition: translate .9s cubic-bezier(.3, .8, .2, 1), rotate .9s, opacity .3s, scale .3s; pointer-events: none; }
.upload-drag img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 6px 14px -4px rgb(0 0 0 / .45); }
.upload-drag img:nth-child(1) { rotate: -9deg; }
.upload-drag img:nth-child(2) { rotate: 7deg; }
.upload-badge { position: absolute; right: -14px; top: -12px; padding: 2px 9px; border-radius: 999px; background: var(--foreground); color: #fff; font-size: .8rem; font-weight: 700; }
.upload-cursor { position: absolute; right: -12px; bottom: -22px; width: 18px; }
.upload[data-phase="drag"] .upload-drag { translate: 0 0; rotate: -3deg; opacity: 1; }
.upload[data-phase="upload"] .upload-drag { translate: 0 0; rotate: -3deg; opacity: 0; scale: .5; }
.upload-status { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px; }
.upload-label { font-weight: 700; }
.upload-progress { display: block; height: 6px; margin-top: 8px; overflow: hidden; background: var(--border); }
.upload-progress i { display: block; height: 100%; background: var(--foreground); transform: scaleX(0); transform-origin: left; }
.upload[data-phase="upload"] .upload-progress i { animation: fill-upload 2.4s linear both; }
.upload[data-phase="faces"] .upload-progress i { animation: fill-faces 2.2s linear both; }
.upload[data-phase="ready"] .upload-progress i { transform: none; }
@keyframes fill-upload { to { transform: none; } }
@keyframes fill-faces { to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .upload * { transition: none !important; animation: none !important; } }
</style>

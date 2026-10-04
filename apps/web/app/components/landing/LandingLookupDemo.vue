<script setup lang="ts">
// A reference face is added and its matches appear one by one: idle → face → search → done.
const MATCHES = ["ev-01", "ev-02", "ev-03", "ev-04", "ev-05", "ev-06", "ev-07", "ev-08"];

const mock = useTemplateRef("mock");
const phase = usePhasesOnView(mock, [["idle", 800], ["face", 1100], ["search", 3300], ["done", 0]] as const);
const found = useCountUp();
watch(phase, (next) => {
  if (next === "search") found.countTo(MATCHES.length, MATCHES.length * 320 + 300);
});
</script>

<template>
  <div ref="mock" class="mock lookup" :data-phase="phase">
    <div class="lookup-ref">
      <span class="lookup-slot"><img src="/landing/face.jpg" alt=""></span>
      <span>
        <b>{{ phase === "idle" ? "Add your selfie" : "Your selfie" }}</b>
        <small>{{ phase === "idle" ? "JPEG, PNG, or WebP" : "my-photo.jpg" }}</small>
      </span>
    </div>
    <p class="lookup-count">
      <template v-if="phase === 'idle'">Waiting for your selfie</template>
      <template v-else-if="phase === 'face'">Ready to search 5,214 photos</template>
      <template v-else-if="phase === 'search'">Searching 5,214 photos: {{ found.count.value }} found</template>
      <template v-else><b>8 matches</b> in 5,214 photos</template>
    </p>
    <div class="lookup-grid">
      <span v-for="(photo, k) in MATCHES" :key="photo" :style="{ '--k': k }"><img :src="`/landing/${photo}.jpg`" alt=""></span>
    </div>
  </div>
</template>

<style scoped>
.mock { width: 100%; max-width: 440px; padding: clamp(16px, 2.4vw, 24px); background: #fff; color: var(--foreground); box-shadow: var(--lift); font-size: .95rem; line-height: 1.35; }
.lookup-ref { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 2px solid var(--foreground); line-height: 1.3; }
.lookup-slot { flex: none; width: 60px; height: 60px; overflow: hidden; border: 2px dashed #c2c2bd; border-radius: 50%; }
.lookup-slot img { width: 100%; height: 100%; object-fit: cover; scale: 0; transition: scale .45s cubic-bezier(.2, .9, .3, 1.3); }
.lookup:not([data-phase="idle"]) .lookup-slot { border: 3px solid var(--brand); }
.lookup:not([data-phase="idle"]) .lookup-slot img { scale: 1; }
.lookup-ref b, .lookup-ref small { display: block; }
.lookup-ref small, .lookup-count { color: var(--muted-foreground); }
.lookup-count { margin: 14px 0 10px; }
.lookup-count b { color: var(--foreground); font-weight: 800; }
.lookup-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.lookup-grid span { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: var(--muted); }
.lookup-grid img { width: 100%; height: 100%; object-fit: cover; opacity: 0; scale: .7; transition: opacity .25s, scale .35s cubic-bezier(.2, .9, .3, 1.3); }
.lookup-grid span::after { content: ""; position: absolute; inset: 0; border: 3px solid var(--brand); opacity: 0; }
.lookup[data-phase="search"] .lookup-grid span { background: linear-gradient(90deg, var(--muted) 35%, #fbfbf9 50%, var(--muted) 65%) 0 0 / 300% 100%; animation: shimmer 1.1s linear infinite; }
.lookup:is([data-phase="search"], [data-phase="done"]) .lookup-grid img { opacity: 1; scale: 1; transition-delay: calc(var(--k) * 320ms + .3s); }
.lookup[data-phase="search"] .lookup-grid span::after { animation: flash .9s ease forwards; animation-delay: calc(var(--k) * 320ms + .3s); }
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes flash { 0%, 40% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .lookup * { transition: none !important; animation: none !important; } }
</style>

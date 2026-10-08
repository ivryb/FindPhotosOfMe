<script setup lang="ts">
// A white dashboard panel with a title and, on the right, a short summary. `saved` briefly shows that a change was saved.
defineProps<{ title: string; saved?: boolean }>();
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>{{ title }}</h2>
      <slot name="aside" />
      <p v-if="saved" class="saved" role="status">Saved</p>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.card { padding: clamp(20px, 3vw, 32px); background: var(--background); border-radius: 14px; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; margin-bottom: 18px; }
h2 { font-size: 1.6rem; font-stretch: 112%; letter-spacing: -.02em; }
.card-head :slotted(p) { color: var(--muted-foreground); }
.card-head :slotted(p b) { color: var(--foreground); font-size: 1.15rem; font-weight: 800; font-stretch: 112%; font-variant-numeric: tabular-nums; }
.saved { color: #1d6b33; font-weight: 650; animation: fade 2.4s ease-out both; }
@keyframes fade { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .saved { animation: none; } }
@media (max-width: 900px) { .card { padding: 20px 0; border-radius: 0; } }
</style>

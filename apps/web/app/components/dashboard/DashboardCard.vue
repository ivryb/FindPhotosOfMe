<script setup lang="ts">
// A white dashboard panel with a title and, on the right, a short summary.
defineProps<{ title: string }>();
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h2>{{ title }}</h2>
      <slot name="aside" />
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
@media (max-width: 900px) { .card { padding: 20px 0; border-radius: 0; } }
</style>

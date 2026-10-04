<script setup lang="ts">
// A section heading: on the left by default, so the section starts with content instead of a gap,
// or centered above a centered composition.
withDefaults(defineProps<{ title: string; text: string; centered?: boolean }>(), { centered: false });
</script>

<template>
  <div :class="centered ? 'center-head' : 'head-row'">
    <h2>{{ title }}</h2>
    <p>{{ text }}</p>
  </div>
</template>

<style scoped>
.head-row { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: end; gap: 20px clamp(32px, 6vw, 88px); margin-bottom: clamp(40px, 5vw, 64px); }
.head-row h2 { font-size: clamp(1.9rem, 3.8vw, 3rem); line-height: 1.04; }
.head-row p { max-width: 44ch; color: var(--section-muted); font-size: clamp(1.05rem, 1.5vw, 1.25rem); text-wrap: pretty; }
@media (max-width: 860px) { .head-row { grid-template-columns: 1fr; } }

.center-head { max-width: 800px; margin: 0 auto clamp(40px, 5vw, 64px); text-align: center; }
.center-head h2 { margin-bottom: 22px; }
.center-head p { max-width: 58ch; margin-inline: auto; color: var(--section-muted); font-size: clamp(1.05rem, 1.5vw, 1.25rem); text-wrap: pretty; }
</style>

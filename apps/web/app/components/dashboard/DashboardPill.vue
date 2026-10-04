<script setup lang="ts">
import type { StatusTone } from "@/utils/galleries";

defineProps<{ tone: StatusTone }>();
</script>

<template>
  <span :class="['pill', tone]"><slot /></span>
</template>

<style scoped>
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 700; line-height: 1.4; white-space: nowrap; }
.ok { background: #e1f4e4; color: #1d6b33; }
.busy { background: #fff3c4; color: #6b5300; }
.busy::before { content: ""; width: 7px; height: 7px; background: currentColor; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
.bad { background: #fde6e3; color: #a8261a; }
.idle { background: var(--muted); color: var(--muted-foreground); }
@keyframes pulse { 50% { opacity: .35; } }
</style>

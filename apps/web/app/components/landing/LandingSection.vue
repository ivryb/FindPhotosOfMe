<script setup lang="ts">
// A full-width band. The tone sets the background, and --section-muted gives secondary text
// a color that reads on it; product screens inside reset it for themselves.
withDefaults(defineProps<{ tone?: "paper" | "grey" | "ink" | "brand" }>(), { tone: "paper" });
</script>

<template>
  <section :class="['section', tone]">
    <div class="wrap">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.section { --section-muted: var(--muted-foreground); padding-block: clamp(72px, 10vw, 136px); }
.grey { background: var(--muted); }
.ink { --section-muted: #b3b3ad; overflow-x: clip; background: var(--foreground); color: var(--background); }
.ink :deep(:focus-visible) { outline-color: var(--brand); }
.brand { --section-muted: #4f4826; overflow-x: clip; background: var(--brand); color: var(--brand-foreground); }
</style>

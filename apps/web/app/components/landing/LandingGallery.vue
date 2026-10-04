<script setup lang="ts">
// The event page, large, on a yellow band that echoes the hero.
defineProps<{ title: string; text: string }>();
</script>

<template>
  <section id="gallery" class="gallery">
    <div class="wrap"><LandingHeadRow :title="title" :text="text" /></div>
    <div class="stage">
      <div class="wrap"><LandingEventPage /></div>
    </div>
  </section>
</template>

<style scoped>
.gallery { --section-muted: var(--muted-foreground); padding-top: clamp(72px, 10vw, 136px); }
.stage { padding-bottom: clamp(56px, 7vw, 96px); background: linear-gradient(transparent 30%, var(--brand) 0); }
</style>

<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { Button } from "@/components/ui/button";

// The mobile front door is the gallery list in DashboardShell; desktop keeps that list beside this prompt.
const { galleries, creating } = useDashboard();

useSeoMeta({ title: "Your galleries · FindPhotosOfMe" });
</script>

<template>
  <section v-if="galleries.length" class="empty">
    <h1>Your galleries</h1>
    <p>Choose a gallery to manage its photos and page.</p>
  </section>
  <section v-else class="empty">
    <h1>Make your first gallery</h1>
    <p>Upload your event photos as ZIP files. Search privately, then publish to share a link and QR code so people can find their photos with a selfie.</p>
    <Button size="xl" @click="creating = true"><Plus />New gallery</Button>
  </section>
</template>

<style scoped>
.empty { display: grid; justify-items: start; gap: 18px; max-width: 34rem; padding-block: clamp(24px, 8vh, 80px); }
h1 { font-size: clamp(2.2rem, 4.6vw, 3.6rem); }
p { color: var(--muted-foreground); font-size: 1.1rem; }
</style>

<script setup lang="ts">
import { SUPPORT_EMAIL } from "@/utils/landing";

// Where the pricing and questions anchors live: this page, or the homepage.
defineProps<{ base: string }>();
</script>

<template>
  <footer>
    <div class="wrap">
      <NuxtLink class="logo" to="/">FindPhotosOfMe</NuxtLink>
      <span>Event photo galleries with selfie search.</span>
      <nav aria-label="Footer">
        <NuxtLink to="/organizers">Event organizers</NuxtLink>
        <NuxtLink to="/photographers">Photographers</NuxtLink>
        <NuxtLink to="/personal">Personal use</NuxtLink>
        <a :href="`${base}#pricing`">Pricing</a>
        <a :href="`${base}#questions`">Questions</a>
      </nav>
      <nav class="policies" aria-label="Policies">
        <NuxtLink to="/terms">Terms</NuxtLink>
        <NuxtLink to="/privacy">Privacy</NuxtLink>
        <NuxtLink to="/refunds">Refunds</NuxtLink>
        <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
footer { padding-block: 36px; color: var(--muted-foreground); font-size: .92rem; }
.wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; }
.logo { color: var(--foreground); font-size: 1.15rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
nav { display: flex; flex-wrap: wrap; gap: 20px; margin-left: auto; }
nav a:hover { text-decoration: underline; }
.policies { flex-basis: 100%; justify-content: flex-end; font-size: .85rem; }
@media (max-width: 640px) { .policies { justify-content: flex-start; margin-left: 0; } }
</style>

<script setup lang="ts">
import { Button } from "@/components/ui/button";

defineProps<{ title: string; text: string }>();
</script>

<template>
  <LandingSection tone="brand">
    <div class="final">
      <h2>{{ title }}</h2>
      <p>{{ text }}</p>
      <Button as-child size="xl"><NuxtLink to="/admin">Try it free</NuxtLink></Button>
      <small>Up to 500 photos free. No card needed.</small>
    </div>
  </LandingSection>
</template>

<style scoped>
.final { text-align: center; }
h2 { max-width: 14ch; margin-inline: auto; font-size: clamp(2.3rem, 6.2vw, 4.8rem); }
p { max-width: 44ch; margin: 24px auto 30px; font-size: 1.2rem; font-weight: 500; }
small { display: block; margin-top: 18px; font-weight: 600; }
</style>

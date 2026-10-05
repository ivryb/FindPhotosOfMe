<script setup lang="ts">
import { Button } from "@/components/ui/button";

// Yellow, centered, with a product screen (the default slot) hanging over the edge into white.
defineProps<{ title: string; lede: string; ticks: string[] }>();
</script>

<template>
  <section class="hero">
    <div class="wrap">
      <h1>{{ title }}</h1>
      <p class="lede">{{ lede }}</p>
      <div class="actions">
        <Button as-child size="xl"><NuxtLink to="/admin">Try it free</NuxtLink></Button>
        <Button as-child size="xl" variant="outline"><a href="#how">See how it works</a></Button>
      </div>
      <ul class="ticks">
        <li v-for="tick in ticks" :key="tick">{{ tick }}</li>
      </ul>
      <div class="screen">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero { padding-top: clamp(40px, 5vw, 64px); background: linear-gradient(var(--brand) calc(100% - 220px), var(--background) 0); color: var(--brand-foreground); text-align: center; }
.lede { max-width: 54ch; margin: 24px auto 0; font-size: clamp(1.1rem, 1.6vw, 1.3rem); font-weight: 500; }
.actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
.ticks { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 26px; margin-top: 20px; font-size: .95rem; font-weight: 600; }
.ticks li::before { content: "✓ "; font-weight: 900; }
.screen { margin-top: clamp(40px, 5vw, 60px); text-align: left; }
.screen :deep(.browser) { box-shadow: 0 40px 70px -40px rgb(0 0 0 / .6); }
</style>

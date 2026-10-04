<script setup lang="ts">
import { Button } from "@/components/ui/button";

const audiences = [
  { to: "/organizers", label: "Event organizers" },
  { to: "/photographers", label: "Photographers" },
  { to: "/personal", label: "Personal use" },
];
</script>

<template>
  <header class="top">
    <div class="wrap">
      <NuxtLink class="logo" to="/">FindPhotosOfMe</NuxtLink>
      <nav aria-label="Main">
        <NuxtLink v-for="link in audiences" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
        <a href="#pricing">Pricing</a>
        <a href="#questions">Questions</a>
      </nav>
      <Button as-child size="lg" class="font-bold"><NuxtLink to="/admin">Try it free</NuxtLink></Button>
    </div>
  </header>
</template>

<style scoped>
.top { position: sticky; top: 0; z-index: 20; background: var(--brand); box-shadow: 0 1px 0 rgb(0 0 0 / .08); }
.wrap { display: flex; align-items: center; gap: 28px; height: 72px; }
.logo { margin-right: auto; font-size: 1.15rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
nav { display: flex; gap: 24px; }
nav a { font-size: .95rem; font-weight: 600; }
nav a:hover, nav a[aria-current="page"] { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 5px; }
@media (max-width: 900px) { nav { display: none; } }
</style>

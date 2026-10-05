<script setup lang="ts">
import { Menu, X } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui";
import { Button } from "@/components/ui/button";

const open = ref(false);
const mobile = useMediaQuery("(max-width: 1080px)");
watch(mobile, () => (open.value = false));

const audiences = [
  { to: "/organizers", label: "Event organizers" },
  { to: "/photographers", label: "Photographers" },
  { to: "/personal", label: "Personal use" },
];

function closeOnEscape(event: KeyboardEvent) {
  if (!open.value) return;
  open.value = false;
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.querySelector<HTMLButtonElement>(".menu-toggle")?.focus();
}
</script>

<template>
  <CollapsibleRoot v-model:open="open" as="header" class="top" @keydown.esc="closeOnEscape">
    <div class="wrap">
      <NuxtLink class="logo" to="/">FindPhotosOfMe</NuxtLink>
      <nav class="desktop-nav" aria-label="Main">
        <NuxtLink v-for="link in audiences" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
        <a href="#pricing">Pricing</a>
        <a href="#questions">Questions</a>
      </nav>
      <Button as-child size="lg" class="desktop-cta font-bold"><NuxtLink to="/admin">Try it free</NuxtLink></Button>
      <CollapsibleTrigger as-child>
        <Button type="button" variant="ghost" size="icon" class="menu-toggle" :aria-label="open ? 'Close menu' : 'Open menu'">
          <X v-if="open" class="size-6" aria-hidden="true" />
          <Menu v-else class="size-6" aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent class="mobile-panel">
      <nav class="mobile-nav" aria-label="Main" @click="open = false">
        <NuxtLink v-for="link in audiences" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
        <a href="#pricing">Pricing</a>
        <a href="#questions">Questions</a>
        <Button as-child size="lg" class="mobile-cta"><NuxtLink to="/admin">Try it free</NuxtLink></Button>
      </nav>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
.top { position: sticky; top: 0; z-index: 20; background: var(--brand); box-shadow: 0 1px 0 rgb(0 0 0 / .08); }
.wrap { display: flex; align-items: center; gap: 28px; height: 72px; }
.logo { margin-right: auto; font-size: 1.15rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
.desktop-nav { display: flex; gap: 24px; }
nav a { font-size: .95rem; font-weight: 600; }
nav a:hover, nav a[aria-current="page"] { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 5px; }
.menu-toggle, .mobile-panel { display: none; }
@media (max-width: 1080px) {
  .wrap { gap: 16px; }
  .desktop-nav, .desktop-cta { display: none; }
  .menu-toggle { display: inline-flex; width: 44px; height: 44px; }
  .mobile-panel:not([hidden]) { display: block; border-top: 1px solid rgb(0 0 0 / .15); max-height: calc(100dvh - 72px); overflow-y: auto; }
  .mobile-nav { display: flex; flex-direction: column; padding: 12px clamp(20px, 4vw, 40px) 24px; }
  .mobile-nav > a { display: flex; align-items: center; min-height: 48px; font-size: 1.05rem; }
  .mobile-cta { margin-top: 12px; }
}
</style>

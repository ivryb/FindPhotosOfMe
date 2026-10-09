<script setup lang="ts">
// A policy page: the landing frame around one column of plain prose.
defineProps<{ title: string; updated: string }>();
</script>

<template>
  <LandingPage policy>
    <LandingSection>
      <article class="policy">
        <h1>{{ title }}</h1>
        <p class="updated">Last updated {{ updated }}</p>
        <slot />
      </article>
    </LandingSection>
  </LandingPage>
</template>

<style scoped>
.policy { max-width: 68ch; margin-inline: auto; }
.policy h1 { margin-bottom: 8px; font-size: clamp(2.2rem, 5vw, 3.4rem); }
.updated { margin-bottom: 40px; color: var(--muted-foreground); font-size: .95rem; }
.policy :deep(h2) { margin: 40px 0 12px; font-size: 1.4rem; font-weight: 750; font-stretch: 110%; line-height: 1.25; }
.policy :deep(p), .policy :deep(ul) { margin-bottom: 14px; }
.policy :deep(ul) { padding-left: 1.2em; list-style: disc; }
.policy :deep(li) { margin-bottom: 6px; }
.policy :deep(a) { text-decoration: underline; text-underline-offset: 3px; }
</style>

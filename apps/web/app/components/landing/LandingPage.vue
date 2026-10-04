<script setup lang="ts">
// The frame shared by the homepage and the audience pages: top bar, content, footer.
</script>

<template>
  <div class="landing">
    <LandingHeader />
    <main>
      <slot />
    </main>
    <LandingFooter />
  </div>
</template>

<style scoped>
.landing {
  --wrap: 1140px;
  font-size: 18px;
  line-height: 1.6;
}
/* Defaults for every section; :where around both parts keeps them weaker than any section style */
:where(.landing) :deep(:where(h1)) { font-size: clamp(2.4rem, 6vw, 4.8rem); }
:where(.landing) :deep(:where(h2)) { font-size: clamp(1.9rem, 4.4vw, 3.4rem); }
:where(.landing) :deep(:where(h3)) { font-size: 1.3rem; font-weight: 700; font-stretch: 110%; line-height: 1.2; }
:where(.landing) :deep(:where(:focus-visible)) { outline: 3px solid var(--foreground); outline-offset: 3px; }
:where(.landing) :deep(:where(.wrap)) { max-width: var(--wrap); margin-inline: auto; padding-inline: clamp(20px, 4vw, 40px); }
:where(.landing) :deep(:where([id])) { scroll-margin-top: 72px; }
</style>

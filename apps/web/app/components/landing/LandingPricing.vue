<script setup lang="ts">
import LandingPricingCalculator from "./LandingPricingCalculator.vue";

defineProps<{ title: string; text: string; note: string }>();
</script>

<template>
  <LandingSection id="pricing">
    <div class="pricing">
      <h2>{{ title }}</h2>
      <p class="lede">{{ text }}</p>
      <LandingPricingCalculator />
      <p class="note">{{ note }} No subscription. $10 minimum payment. USD before tax.</p>
    </div>
  </LandingSection>
</template>

<style scoped>
.pricing { text-align: center; }
h2 { max-width: 18ch; margin: 0 auto 20px; }
.lede { max-width: 54ch; margin: 0 auto 32px; color: var(--section-muted); font-size: clamp(1.1rem, 1.6vw, 1.3rem); }
.note { margin-top: 24px; color: var(--section-muted); font-size: .9rem; }
</style>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { PRICE_TEXT } from "@/utils/pricing";
import LandingPricingCalculator from "./LandingPricingCalculator.vue";

// The free trial first and loudest, then the calculator for anyone who needs more.
defineProps<{ title: string; text: string; note: string }>();
</script>

<template>
  <LandingSection id="pricing">
    <div class="head">
      <h2>{{ title }}</h2>
      <p>{{ text }}</p>
    </div>

    <div class="free">
      <p class="free-title"><span>Start with</span>Free</p>
      <ul>
        <li><b>{{ PRICE_TEXT.trialPhotos }}</b>photos</li>
        <li><b>{{ PRICE_TEXT.trialSearches }}</b>selfie searches</li>
        <li><b>7</b>days online</li>
      </ul>
      <div class="free-action">
        <Button as-child size="xl"><NuxtLink to="/admin">Try it free</NuxtLink></Button>
        <small>No card needed.</small>
      </div>
    </div>

    <h3 class="more">Need more? Calculate your price</h3>
    <LandingPricingCalculator />
    <p class="note">{{ note }} No subscription. {{ PRICE_TEXT.minimum }} minimum payment. USD before tax.</p>
  </LandingSection>
</template>

<style scoped>
.head { margin-bottom: clamp(32px, 4vw, 48px); text-align: center; }
.head h2 { max-width: 18ch; margin: 0 auto 20px; }
.head p { max-width: 54ch; margin-inline: auto; color: var(--section-muted); font-size: clamp(1.1rem, 1.6vw, 1.3rem); }

.free { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 24px clamp(28px, 4vw, 56px); padding: clamp(24px, 3.5vw, 44px); background: var(--brand); color: var(--brand-foreground); border-radius: 24px; }
.free-title { font-size: clamp(3.4rem, 7vw, 5.6rem); font-weight: 850; font-stretch: 118%; letter-spacing: -.05em; line-height: .95; }
.free-title span { display: block; margin-bottom: 6px; font-size: 1rem; font-weight: 650; font-stretch: 100%; letter-spacing: 0; }
.free ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding-left: clamp(0px, 3vw, 40px); border-left: 2px solid rgb(21 21 21 / .2); }
.free li { line-height: 1.25; }
.free li b { display: block; font-size: clamp(2rem, 3.4vw, 2.8rem); font-weight: 850; font-stretch: 118%; letter-spacing: -.04em; line-height: 1.05; }
.free-action { display: grid; justify-items: center; gap: 8px; }
.free-action small { color: #4f4826; font-size: .9rem; font-weight: 600; }

.more { margin: clamp(48px, 6vw, 72px) 0 18px; font-size: clamp(1.4rem, 2.4vw, 1.9rem); font-weight: 800; font-stretch: 112%; letter-spacing: -.02em; text-align: center; }
.note { margin-top: 24px; color: var(--section-muted); font-size: .9rem; text-align: center; }

@media (max-width: 900px) {
  .free { grid-template-columns: minmax(0, 1fr); }
  .free ul { padding: 20px 0 0; border-top: 2px solid rgb(21 21 21 / .2); border-left: 0; }
  .free-action { justify-items: stretch; text-align: center; }
}
</style>

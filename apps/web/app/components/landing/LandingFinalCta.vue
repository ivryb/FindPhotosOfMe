<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { PRICE_TEXT } from "@/utils/pricing";

// The last call to try it, at the bottom of every landing page: the pitch beside a receipt for the free trial.
defineProps<{ title: string; text: string }>();
</script>

<template>
  <LandingSection tone="brand">
    <div class="final">
      <div>
        <h2>{{ title }}</h2>
        <p class="lede">{{ text }}</p>
        <Button as-child size="xl"><NuxtLink to="/admin">Start free</NuxtLink></Button>
      </div>
      <div class="receipt-shadow">
        <div class="receipt">
          <p class="receipt-head"><img src="/icon.svg" alt="">Your free trial</p>
          <dl>
            <div><dt>{{ PRICE_TEXT.trialPhotos }} photos</dt><dd>Free</dd></div>
            <div><dt>{{ PRICE_TEXT.trialSearches }} selfie searches</dt><dd>Free</dd></div>
            <div><dt>7 days online</dt><dd>Free</dd></div>
            <div><dt>Card</dt><dd>Not needed</dd></div>
          </dl>
          <p class="receipt-total"><span>You pay</span><b>$0</b></p>
        </div>
      </div>
    </div>
  </LandingSection>
</template>

<style scoped>
.final { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: center; gap: 48px clamp(40px, 7vw, 96px); }
h2 { font-size: clamp(2.3rem, 6vw, 4.6rem); }
.lede { max-width: 40ch; margin: 22px 0 30px; font-size: clamp(1.1rem, 1.6vw, 1.3rem); font-weight: 500; text-wrap: pretty; }
/* The mask that cuts the torn edge would also cut a shadow, so the shadow sits on a wrapper */
.receipt-shadow { rotate: 1.5deg; filter: drop-shadow(0 24px 24px rgb(0 0 0 / .16)); }
.receipt { --tooth: 18px; padding: 28px 28px calc(28px + var(--tooth) / 2); background: #fff; mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / var(--tooth) 100%; border-radius: 12px 12px 0 0; }
.receipt-head { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; border-bottom: 2px solid var(--foreground); font-size: 1.1rem; font-weight: 800; font-stretch: 112%; }
.receipt-head img { width: 30px; height: 30px; }
.receipt dl > div { display: flex; justify-content: space-between; gap: 16px; padding-block: 14px; border-bottom: 1px dashed var(--border); }
.receipt dd { font-weight: 700; }
.receipt-total { display: flex; align-items: baseline; justify-content: space-between; padding-top: 18px; font-weight: 700; }
.receipt-total b { font-size: clamp(3rem, 6vw, 4.4rem); font-weight: 850; font-stretch: 118%; letter-spacing: -.05em; line-height: 1; }
@media (max-width: 760px) { .final { grid-template-columns: 1fr; } }
</style>

<script setup lang="ts">
// Two numbered steps on the ink band, each with its animated demo.
defineProps<{
  intro: string;
  upload: { title: string; text: string; name?: string };
  search: { title: string; text: string };
}>();
</script>

<template>
  <LandingSection id="how" tone="ink">
    <LandingHeadRow title="How it works" :text="intro" />
    <ol class="steps">
      <li class="step">
        <div class="step-art" aria-hidden="true"><LandingUploadDemo :name="upload.name" /></div>
        <div class="step-text">
          <h3>{{ upload.title }}</h3>
          <p>{{ upload.text }}</p>
        </div>
      </li>
      <li class="step">
        <div class="step-art" aria-hidden="true"><LandingLookupDemo /></div>
        <div class="step-text">
          <h3>{{ search.title }}</h3>
          <p>{{ search.text }}</p>
        </div>
      </li>
    </ol>
  </LandingSection>
</template>

<style scoped>
/* The shared row and stretched cards keep both demos aligned as their content changes. */
.steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px clamp(28px, 4vw, 56px); counter-reset: step; }
.step { display: grid; grid-row: span 2; grid-template-rows: subgrid; counter-increment: step; }
.step-art { display: flex; align-items: stretch; justify-content: center; overflow: hidden; padding: clamp(18px, 3.5vw, 40px); background: #222220; border-radius: 10px; }
.step-text { display: grid; grid-template-columns: auto 1fr; align-content: start; column-gap: 18px; }
.step-text::before { content: counter(step); grid-row: span 2; color: var(--brand); font-size: clamp(3rem, 5vw, 4.2rem); font-weight: 900; font-stretch: 125%; letter-spacing: -0.04em; line-height: .85; }
.step h3 { margin-bottom: 10px; font-size: clamp(1.4rem, 2.4vw, 1.9rem); font-weight: 800; font-stretch: 112%; letter-spacing: -0.02em; line-height: 1.1; }
.step p { max-width: 44ch; color: var(--section-muted); }
@media (max-width: 860px) {
  .steps { grid-template-columns: 1fr; row-gap: 56px; }
  .step { grid-row: auto; grid-template-rows: none; row-gap: 24px; }
}
</style>

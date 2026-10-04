<script setup lang="ts">
// Big type, one kind of photo pile per line.
const USES = [
  { title: "Your wedding album", text: "Send each guest a link to the photos they’re in." },
  { title: "Years of family photos", text: "Pull out every photo of your grandmother." },
  { title: "A trip with friends", text: "Everyone gets their own photos, not the whole camera roll." },
  { title: "Your kid’s football season", text: "Find your kid in every team photo and match shot." },
];
</script>

<template>
  <LandingSection id="uses">
    <LandingHeadRow
      title="Any pile of photos with people in it"
      text="Find one person in thousands of photos, or share a link so everyone can find themselves."
    />
    <ul class="uses">
      <li v-for="use in USES" :key="use.title"><b>{{ use.title }}</b><span>{{ use.text }}</span></li>
    </ul>
  </LandingSection>
</template>

<style scoped>
.uses { border-top: 3px solid var(--foreground); }
li { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: baseline; gap: 8px clamp(24px, 4vw, 56px); padding: clamp(20px, 2.6vw, 30px) 0; border-bottom: 1px solid var(--border); }
b { font-size: clamp(1.6rem, 3.6vw, 2.8rem); font-weight: 800; font-stretch: 116%; letter-spacing: -.03em; line-height: 1.02; }
span { color: var(--section-muted); font-size: clamp(1.05rem, 1.5vw, 1.2rem); }
@media (max-width: 760px) { li { grid-template-columns: 1fr; } }
</style>

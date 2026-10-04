<script setup lang="ts">
// The phone in the middle on a disc, what happens on either side. On yellow the disc turns ink.
withDefaults(defineProps<{ title: string; text: string; tone?: "ink" | "brand" }>(), { tone: "ink" });

const NOTES = {
  left: [
    { title: "Send a selfie", text: "Attendees message the bot one photo of their face." },
    { title: "Nothing to install", text: "It works in the chat app they already use." },
  ],
  right: [
    { title: "Get the photos back", text: "The bot replies with every photo they’re in." },
    { title: "Telegram or WhatsApp", text: "Pick the app your attendees use most." },
  ],
};
</script>

<template>
  <LandingSection id="bot" :tone="tone">
    <LandingHeadRow centered :title="title" :text="text" />
    <div :class="['annotated', tone]">
      <div class="notes notes-left">
        <div v-for="note in NOTES.left" :key="note.title" class="note"><h3>{{ note.title }}</h3><p>{{ note.text }}</p></div>
      </div>
      <div class="phone"><LandingBotPhone /></div>
      <div class="notes">
        <div v-for="note in NOTES.right" :key="note.title" class="note"><h3>{{ note.title }}</h3><p>{{ note.text }}</p></div>
      </div>
    </div>
  </LandingSection>
</template>

<style scoped>
.annotated { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: clamp(24px, 4vw, 64px); }
.notes { display: grid; gap: clamp(32px, 5vw, 64px); }
.notes-left { text-align: right; }
.notes-left .note { margin-left: auto; }
.note { max-width: 28ch; }
.note h3 { margin-bottom: 8px; }
.note p { color: var(--section-muted); }
.phone { position: relative; padding: 0 clamp(16px, 3vw, 40px); }
.phone::before { content: ""; position: absolute; top: 50%; left: 50%; width: 120%; aspect-ratio: 1; translate: -50% -50%; background: var(--brand); border-radius: 50%; }
.brand .phone::before { background: var(--foreground); }
.phone :deep(.iphone) { position: relative; width: 300px; }
@media (max-width: 900px) {
  .annotated { grid-template-columns: 1fr 1fr; }
  .phone { grid-column: 1 / -1; grid-row: 1; justify-self: center; }
  .notes-left { text-align: left; }
  .notes-left .note { margin-left: 0; }
}
</style>

<script setup lang="ts">
// A photographer's account with several shoots, each with its own gallery and link.
const EVENTS = [
  { photo: "case-wedding", name: "Marta and Joon’s wedding", photos: "1,860", ready: true, link: "marta-joon.findphotosofme.com" },
  { photo: "case-race", name: "City half marathon", photos: "18,420", ready: false, link: "cityhalf.findphotosofme.com" },
  { photo: "nx-01", name: "Harbor Summit Lisbon", photos: "5,214", ready: true, link: "harborsummit.findphotosofme.com" },
  { photo: "p20", name: "Northwind team offsite", photos: "742", ready: true, link: "northwind.findphotosofme.com" },
];
</script>

<template>
  <LandingSection id="events">
    <LandingHeadRow
      title="All your events in one account"
      text="Every shoot gets its own gallery and link. Keep them all in one place, from last weekend’s wedding to next month’s marathon."
    />
    <div class="dash" role="img" aria-label="A list of four events with their photo counts, status, and gallery links.">
      <div class="dash-head" aria-hidden="true"><b>Lumen Studio events</b><span class="new">New event</span></div>
      <table aria-hidden="true">
        <thead><tr><th>Event</th><th>Photos</th><th>Status</th><th>Gallery link</th></tr></thead>
        <tbody>
          <tr v-for="event in EVENTS" :key="event.name">
            <td><img :src="`/landing/${event.photo}.jpg`" alt="">{{ event.name }}</td>
            <td>{{ event.photos }}</td>
            <td><span :class="['state', { busy: !event.ready }]">{{ event.ready ? "Ready" : "Finding faces" }}</span></td>
            <td>{{ event.link }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </LandingSection>
</template>

<style scoped>
.dash { overflow: hidden; background: #fff; border-radius: 12px; box-shadow: var(--lift); }
.dash-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 24px; border-bottom: 2px solid var(--foreground); }
.dash-head b { font-size: 1.15rem; font-weight: 800; font-stretch: 112%; }
.new { padding: 10px 18px; background: var(--foreground); color: #fff; border-radius: 6px; font-size: .95rem; font-weight: 700; }
table { width: 100%; border-collapse: collapse; font-size: .95rem; }
th { padding: 12px 24px; color: var(--muted-foreground); font-size: .85rem; font-weight: 600; text-align: left; }
td { padding: 14px 24px; border-top: 1px solid var(--border); white-space: nowrap; }
td:first-child { font-weight: 700; }
td img { display: inline-block; width: 56px; margin-right: 14px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; vertical-align: middle; }
td:last-child { color: var(--muted-foreground); }
.state { display: inline-block; padding: 3px 10px; background: #e1f4e4; color: #1d6b33; border-radius: 999px; font-size: .8rem; font-weight: 700; }
.state.busy { background: #fff3c4; color: #6b5300; }
@media (max-width: 860px) { th:nth-child(4), td:nth-child(4) { display: none; } td, th { padding-inline: 14px; } td { white-space: normal; } td img { display: none; } }
</style>

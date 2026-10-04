<script setup lang="ts">
import { ArrowUpRight } from "@lucide/vue";

// Two sides of every search: people who share the photos, and people who look for themselves in them.
// Each finder is the counterpart of the sharer in the same row.
const SHARERS = [
  { to: "/organizers", name: "Event organizers", text: "Conferences, meetups, races, and company events" },
  { to: "/photographers", name: "Photographers", text: "Event, wedding, and sports shoots" },
  { to: "/personal", name: "Anyone with a pile of photos", text: "A wedding album, a family archive, a trip" },
];
const FINDERS = [
  { name: "Attendees", text: "Find themselves among thousands of event photos" },
  { name: "Guests", text: "Find their shots in the photographer’s gallery" },
  { name: "Friends and family", text: "Get the photos they’re in, not the whole album" },
];
const PILE = ["nx-05", "p03", "t09", "nx-08", "ev-04"];
const FOUND = ["ev-02", "ev-05", "ev-07"];
</script>

<template>
  <LandingSection id="who" tone="paper">
    <LandingHeadRow
      title="Who it’s for"
      text="Every search has two sides: someone who has the photos, and someone who’s in them."
    />
    <div class="sides">
      <div class="side have">
        <h3>You have the photos</h3>
        <p>Upload them once and share one link. Everyone in them finds their own.</p>
        <div class="strip" aria-hidden="true">
          <img v-for="photo in PILE" :key="photo" :src="`/landing/${photo}.jpg`" alt="">
          <span class="count">5,214 photos</span>
        </div>
        <ul>
          <li v-for="item in SHARERS" :key="item.to">
            <NuxtLink :to="item.to">
              <span class="label">
                <b>{{ item.name }}<ArrowUpRight class="arrow" /></b>
                <span>{{ item.text }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div class="side in">
        <h3>You’re in the photos</h3>
        <p>Got a link from an event? Open it and add a selfie. No account, no app, nothing to pay.</p>
        <div class="strip" aria-hidden="true">
          <img class="face" src="/landing/face.jpg" alt="">
          <img v-for="photo in FOUND" :key="photo" :src="`/landing/${photo}.jpg`" alt="">
          <span class="count">+5</span>
        </div>
        <ul>
          <li v-for="item in FINDERS" :key="item.name">
            <b>{{ item.name }}</b>
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </div>
    </div>
  </LandingSection>
</template>

<style scoped>
/* The panels share rows, so each pair of people lines up even when one side wraps */
.sides { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: clamp(16px, 2vw, 24px); }
.side { display: grid; grid-row: span 6; grid-template-rows: subgrid; padding: clamp(28px, 4vw, 48px); border-radius: 18px; }
ul { display: contents; }
.have { --panel: var(--foreground); background: var(--panel); color: var(--background); }
.have :focus-visible { outline-color: var(--brand); }
.in { --panel: var(--brand); background: var(--panel); color: var(--brand-foreground); }
h3 { font-size: clamp(1.6rem, 2.6vw, 2.1rem); font-weight: 800; font-stretch: 118%; letter-spacing: -.03em; line-height: 1.05; }
.side > p { max-width: 36ch; margin: 14px 0 28px; font-size: 1.1rem; }
.have > p, .have .label > span { color: #b3b3ad; }
.in > p, .in li span { color: #4f4826; }

li { border-top: 1px solid; }
.have li { border-color: #3a3a37; }
.in li { border-color: #e0b70f; }
.in li, .label { display: flex; flex-direction: column; }
.in li { padding: 14px 0; }
li b { font-size: 1.15rem; line-height: 1.3; }
li span { font-size: 1rem; line-height: 1.4; }
.have li a { display: block; padding: 14px 0; }

/* A small arrow after the name marks the row as a link; the name turns yellow on hover */
.arrow { display: inline; width: 18px; height: 18px; margin-left: 6px; color: var(--brand); vertical-align: -2px; transition: translate .15s; }
.have b { transition: color .15s; }
.have a:hover b { color: var(--brand); }
.have a:hover .arrow { translate: 2px -2px; }
@media (prefers-reduced-motion: reduce) { .arrow, .have b { transition: none; } }

.strip { display: flex; align-items: center; margin-bottom: 28px; }
.strip img, .count { width: 64px; height: 64px; margin-right: -10px; border: 3px solid var(--panel); border-radius: 12px; object-fit: cover; }
.strip .face { margin-right: 18px; border-color: var(--brand-foreground); border-radius: 50%; }
.count { display: grid; place-items: center; font-weight: 800; }
.have .count { width: auto; padding-inline: 16px; background: var(--brand); color: var(--brand-foreground); }
.in .count { background: var(--brand-foreground); color: var(--brand); }

@media (max-width: 860px) {
  .sides { grid-template-columns: 1fr; row-gap: 16px; }
  .side { display: flex; flex-direction: column; }
}
@media (max-width: 520px) { .have .strip img:nth-child(n + 4) { display: none; } }
</style>

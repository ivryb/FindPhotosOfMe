<script setup lang="ts">
import { Check, Copy, ExternalLink, Plus } from "@lucide/vue";
import { PRICES, coveredBy } from "@FindPhotosOfMe/backend/convex/pricing";
import { count, formatMoney } from "@/utils/pricing";

// A photographer's dashboard, as in the app: every shoot in the sidebar with the shared balance, one gallery open.
const GALLERIES = [
  { photo: "case-wedding", name: "Marta and Joon’s wedding", status: "1,860 photos, ready", current: true },
  { photo: "case-race", name: "City half marathon", status: "18,420 photos, finding faces", busy: true },
  { photo: "nx-01", name: "Makers Conf 2026", status: "5,214 photos, ready" },
  { photo: "p20", name: "Northwind team offsite", status: "742 photos, ready" },
];

// Tiles of 100 photos: the wedding's 1,860 ready, then the 8,500 more the balance covers at today's prices.
const READY_TILES = 19;
const TILES = 104;
const BALANCE = 8_500 * PRICES.photo;
</script>

<template>
  <LandingSection id="dashboard">
    <LandingHeadRow
      title="All your galleries in one account"
      text="Every shoot gets its own gallery, link, and QR code. One balance pays for all of them."
    />
    <div class="browser" role="img" :aria-label="`The dashboard: four galleries in the sidebar with a ${formatMoney(BALANCE)} balance, and Marta and Joon’s wedding open, with its link, QR code, and 1,860 ready photos.`">
      <div class="browser-bar" aria-hidden="true"><i /><i /><i /><span>findphotosofme.com/admin</span></div>
      <div class="app" aria-hidden="true">
        <div class="bar"><b>FindPhotosOfMe</b><span>Lumen Studio</span><u>Sign out</u></div>
        <div class="shell">
          <aside>
            <span class="new"><Plus />New gallery</span>
            <p class="label">Galleries</p>
            <ul>
              <li v-for="gallery in GALLERIES" :key="gallery.name" :class="{ current: gallery.current }">
                <img :src="`/landing/${gallery.photo}.jpg`" alt="">
                <span><b>{{ gallery.name }}</b><small :class="{ busy: gallery.busy }">{{ gallery.status }}</small></span>
              </li>
            </ul>
            <div class="balance">
              <p class="label">Balance</p>
              <p class="credit">{{ formatMoney(BALANCE) }}</p>
              <p class="covers">About 8,500 photos or {{ count.format(coveredBy(BALANCE, "search")) }} searches</p>
              <span class="top-up">Top up</span>
            </div>
          </aside>

          <div class="main">
            <div class="head">
              <div>
                <span class="pill">Ready</span>
                <p class="title">Marta and Joon’s wedding</p>
                <p class="share">
                  <u>marta-joon.findphotosofme.com</u>
                  <span class="small-button"><Copy />Copy link</span>
                  <span class="small-button wide-only"><ExternalLink />Open page</span>
                </p>
                <p class="meta">1,860 photos. Online until Nov 4.</p>
              </div>
              <div class="qr-card"><LandingQrCode /><small>People scan this to open your gallery.</small></div>
            </div>
            <div class="tabs"><span class="active">Photos</span><span>Gallery page</span><span>Telegram bot</span></div>
            <div class="card">
              <p class="card-head"><b>Photos</b><span><Check />1,860 ready</span></p>
              <div class="sheet">
                <i v-for="n in TILES" :key="n" :class="{ ready: n <= READY_TILES }" />
              </div>
              <p class="legend"><span class="ready">1,860 ready</span><span>Your balance covers 8,500 more</span><em>Each tile is 100 photos</em></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </LandingSection>
</template>

<style scoped>
.browser { overflow: hidden; background: var(--muted); border-radius: 10px; box-shadow: var(--lift); font-size: .9rem; line-height: 1.4; }
.browser-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #e6e6e2; color: var(--muted-foreground); font-size: .8rem; }
.browser-bar i { width: 10px; height: 10px; border-radius: 50%; background: #c9c9c4; }
.browser-bar span { flex: 1; max-width: 320px; margin-left: 10px; padding: 3px 12px; background: #fff; border-radius: 6px; }

.bar { display: flex; align-items: center; gap: 18px; height: 52px; padding-inline: 20px; background: var(--brand); box-shadow: 0 1px 0 rgb(0 0 0 / .08); font-weight: 600; }
.bar b { margin-right: auto; font-weight: 900; font-stretch: 118%; letter-spacing: -.02em; }
.bar u { text-decoration-thickness: 2px; text-underline-offset: 4px; }

.shell { display: grid; grid-template-columns: 250px minmax(0, 1fr); }
aside { display: flex; flex-direction: column; padding: 16px 12px; background: var(--foreground); color: var(--background); }
.new { display: flex; align-items: center; justify-content: center; gap: 6px; height: 38px; margin-bottom: 14px; background: var(--brand); color: var(--foreground); border-radius: 8px; font-weight: 700; }
.new svg { width: 16px; height: 16px; }
.label { padding: 0 8px 6px; color: #8e8e89; font-size: .78rem; font-weight: 600; }
aside li { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; }
aside li.current { background: #2a2a28; box-shadow: inset 3px 0 0 var(--brand); }
aside li img { flex: none; width: 40px; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
aside li b { display: block; font-size: .85rem; line-height: 1.25; }
aside li small { display: block; color: #8e8e89; font-size: .75rem; }
aside li small.busy { color: var(--brand); }
.balance { margin-top: 18px; padding: 14px; background: #222220; border-radius: 12px; }
.balance .label { padding: 0; margin-bottom: 2px; }
.credit { font-size: 1.6rem; font-weight: 800; font-stretch: 112%; letter-spacing: -.02em; }
.covers { color: #b3b3ad; font-size: .78rem; }
.top-up { display: grid; place-items: center; height: 34px; margin-top: 12px; background: var(--brand); color: var(--foreground); border-radius: 8px; font-weight: 700; }

.main { padding: clamp(18px, 2.6vw, 30px); }
.head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 20px; }
.pill { display: inline-block; padding: 2px 10px; background: #e1f4e4; color: #1d6b33; border-radius: 999px; font-size: .75rem; font-weight: 700; }
.title { margin-top: 10px; font-size: clamp(1.5rem, 2.8vw, 2.3rem); font-weight: 800; font-stretch: 118%; letter-spacing: -.03em; line-height: 1; }
.share { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 14px; }
.share u { margin-right: 4px; font-weight: 700; text-decoration-thickness: 2px; text-underline-offset: 4px; }
.small-button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding-inline: 10px; border: 2px solid var(--foreground); border-radius: 6px; font-size: .8rem; font-weight: 600; }
.small-button svg { width: 14px; height: 14px; }
.meta { margin-top: 12px; color: var(--muted-foreground); }
.qr-card { width: 132px; padding: 10px; background: #fff; border-radius: 12px; text-align: center; }
.qr-card small { display: block; margin-top: 6px; color: var(--muted-foreground); font-size: .7rem; line-height: 1.3; }

.tabs { display: flex; gap: 4px; margin-top: 22px; overflow: hidden; border-bottom: 2px solid var(--foreground); }
.tabs span { padding: 8px 14px; border-radius: 8px 8px 0 0; color: var(--muted-foreground); font-weight: 700; font-stretch: 110%; white-space: nowrap; }
.tabs .active { background: var(--foreground); color: var(--background); }
.card { padding: clamp(16px, 2.2vw, 24px); background: #fff; border-radius: 0 12px 12px; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
.card-head b { font-size: 1.25rem; font-weight: 800; font-stretch: 112%; }
.card-head span { display: inline-flex; align-items: center; gap: 6px; color: var(--muted-foreground); }
.card-head svg { width: 16px; height: 16px; }
.sheet { display: grid; grid-template-columns: repeat(26, minmax(0, 1fr)); gap: 3px; }
.sheet i { aspect-ratio: 3 / 2; background: var(--muted); border-radius: 2px; }
.sheet i.ready { background: var(--foreground); }
.legend { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 12px; font-size: .82rem; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend span::before { content: ""; width: 12px; height: 8px; background: var(--muted); border-radius: 2px; }
.legend .ready::before { background: var(--foreground); }
.legend em { margin-left: auto; color: var(--muted-foreground); font-style: normal; }

@media (max-width: 860px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  aside { display: none; }
  .qr-card, .wide-only, .bar span { display: none; }
  .head { grid-template-columns: 1fr; }
  .sheet { grid-template-columns: repeat(13, minmax(0, 1fr)); }
}
</style>

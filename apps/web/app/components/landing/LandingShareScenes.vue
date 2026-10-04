<script setup lang="ts">
// The three places attendees already look: the follow-up email, the closing slide, a card at the exit.
</script>

<template>
  <LandingSection id="share">
    <LandingHeadRow
      title="Share it where attendees already look"
      text="Your event page has one short link. Put it in the follow-up email, on the closing slide, or on a printed card at the exit."
    />
    <ul class="scenes">
      <li>
        <div class="scene" aria-hidden="true">
          <div class="mail">
            <small>From Harbor Summit</small>
            <b>Thanks for coming to Lisbon!</b>
            <i /><i />
            <span>Find your photos</span>
          </div>
        </div>
        <h3>In the follow-up email</h3>
        <p>Everyone gets the link the day after.</p>
      </li>
      <li>
        <div class="scene" aria-hidden="true">
          <div class="slide">
            <div><b>Thank you, Lisbon!</b><small>Scan to find your photos</small></div>
            <div class="slide-qr"><LandingQrCode /></div>
          </div>
        </div>
        <h3>On the closing slide</h3>
        <p>A QR code while the whole room is watching.</p>
      </li>
      <li>
        <div class="scene" aria-hidden="true">
          <div class="card">
            <b>Harbor Summit Lisbon</b>
            <p class="card-title">Find your photos</p>
            <LandingQrCode />
            <small>Scan with your phone camera</small>
          </div>
        </div>
        <h3>On a card at the exit</h3>
        <p>Print it for the coffee tables and the door.</p>
      </li>
    </ul>
  </LandingSection>
</template>

<style scoped>
.scenes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(16px, 2vw, 24px); }
.scene { display: grid; place-items: center; height: 280px; padding: 24px; overflow: hidden; background: var(--muted); border-radius: 14px; }
h3 { margin-top: 16px; }
li > p { margin-top: 6px; color: var(--section-muted); }
.mail { width: 100%; max-width: 280px; padding: 18px; background: #fff; border-radius: 10px; box-shadow: var(--lift); font-size: .85rem; line-height: 1.35; }
.mail small { display: block; color: var(--muted-foreground); }
.mail b { display: block; margin: 4px 0 12px; font-size: 1rem; }
.mail i { display: block; height: 8px; margin-bottom: 7px; background: var(--muted); border-radius: 4px; }
.mail i:nth-of-type(2) { width: 70%; }
.mail span { display: block; margin-top: 14px; padding: 9px; background: var(--foreground); color: #fff; border-radius: 6px; font-weight: 700; text-align: center; }
.slide { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 16px; width: 100%; aspect-ratio: 16 / 9; padding: 20px 22px; background: var(--foreground); color: #fff; border-radius: 6px; box-shadow: var(--lift); }
.slide b { font-size: 1.5rem; font-weight: 800; font-stretch: 116%; letter-spacing: -.02em; line-height: 1; }
.slide small { display: block; margin-top: 8px; color: #b3b3ad; font-size: .8rem; }
.slide-qr { width: 78px; padding: 4px; background: #fff; border-radius: 4px; }
/* The printed card attendees scan at the venue */
.card { width: 132px; padding: 12px; background: var(--brand); border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / .2), 0 24px 40px -16px rgb(0 0 0 / .45); rotate: -4deg; line-height: 1.25; }
.card b { font-size: .7rem; }
.card-title { margin: 4px 0 8px; font-size: 1rem; font-weight: 800; font-stretch: 116%; letter-spacing: -.02em; line-height: 1; }
.card small { display: block; margin-top: 8px; font-size: .7rem; font-weight: 600; }
@media (max-width: 860px) { .scenes { grid-template-columns: 1fr; } }
</style>

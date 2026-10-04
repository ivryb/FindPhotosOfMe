<script setup lang="ts">
// A Telegram chat with the event's bot. The messages arrive one by one when the phone comes into view.
const MATCHES = ["ev-01", "ev-02", "ev-03", "ev-04", "ev-05", "ev-06", "ev-07", "ev-08"];

const phone = useTemplateRef("phone");
const phase = usePhasesOnView(phone, [["idle", 300], ["play", 0]] as const);
</script>

<template>
  <div ref="phone" class="iphone" :data-phase="phase" role="img" aria-label="A chat with the event's bot: someone sends a photo of their face and the bot sends back the 8 photos they're in.">
    <div class="screen" aria-hidden="true">
      <div class="status">
        <span>9:41</span>
        <span class="status-icons">
          <svg viewBox="0 0 17 11" width="17" height="11"><rect y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" width="3" height="11" rx="1" /></svg>
          <svg viewBox="0 0 16 11" width="16" height="11"><path d="M8 2.3c2.2 0 4.2.8 5.7 2.2L15 3.2A10 10 0 0 0 8 .4 10 10 0 0 0 1 3.2l1.3 1.3A8.2 8.2 0 0 1 8 2.3zm0 3.3c1.3 0 2.4.5 3.3 1.3l1.3-1.3A6.4 6.4 0 0 0 8 3.8a6.4 6.4 0 0 0-4.6 1.8l1.3 1.3c.9-.8 2-1.3 3.3-1.3zm0 3.4c-.5 0-.9.2-1.2.5L8 10.6l1.2-1.4c-.3-.3-.7-.5-1.2-.5z" /></svg>
          <svg viewBox="0 0 27 12" width="25" height="12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="8" rx="1.8" /><path d="M24.2 4v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" opacity=".4" /></svg>
        </span>
      </div>
      <div class="app-head">
        <span class="back"><svg viewBox="0 0 10 17" width="10" height="17"><path d="M8.5 1.5 1.5 8.5l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>Chats</span>
        <p class="who"><b>Harbor Summit</b><small>bot</small></p>
        <i class="avatar">H</i>
      </div>
      <div class="msgs">
        <p class="day">Today</p>
        <p class="b out" style="--n:0">/start<time>10:24 <svg viewBox="0 0 16 10" width="15" height="10"><path d="M1 5.5 4 8.5 10.5 1.5M6.5 8.5 13.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></time></p>
        <p class="b in" style="--n:1">Hi! Looking for your photos from <b>Harbor Summit Lisbon</b>?<br><br>Send a selfie to get started 📸<time>10:24</time></p>
        <div class="b out pic" style="--n:2"><img src="/landing/face.jpg" alt=""><time>10:25 <svg viewBox="0 0 16 10" width="15" height="10"><path d="M1 5.5 4 8.5 10.5 1.5M6.5 8.5 13.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></time></div>
        <p class="b in" style="--n:3">Found <b>8</b> matching photos 🥳<time>10:25</time></p>
        <div class="b in album" style="--n:4">
          <div class="album-grid"><img v-for="photo in MATCHES" :key="photo" :src="`/landing/${photo}.jpg`" alt=""></div>
          <time>10:25</time>
        </div>
      </div>
      <div class="app-input">
        <svg viewBox="0 0 24 24" width="24" height="24"><path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        <span class="field">Message</span>
        <svg viewBox="0 0 24 24" width="24" height="24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iphone {
  --wall: linear-gradient(160deg, #d8e3a9, #a6caa5 45%, #cddca9 75%, #e9e3b1);
  --bar: rgb(248 248 248 / .97);
  --out: #e1fec6;
  --out-time: #4fae4e;
  width: min(300px, 100%); aspect-ratio: 390 / 844; padding: 10px; background: #1b1b1d; border-radius: 50px; box-shadow: inset 0 0 0 2px #3a3a3c, var(--lift);
}
.screen { position: relative; display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--wall); color: #000; border-radius: 40px; font: 13px/1.32 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; letter-spacing: -0.01em; }
.screen::before { content: ""; position: absolute; top: 10px; left: 50%; z-index: 2; width: 86px; height: 25px; translate: -50% 0; background: #000; border-radius: 20px; }
.screen::after { content: ""; position: absolute; bottom: 7px; left: 50%; width: 108px; height: 4px; translate: -50% 0; background: #000; border-radius: 4px; }
.screen svg { display: block; flex: none; fill: currentColor; }
.status { display: flex; flex: none; align-items: center; justify-content: space-between; height: 46px; padding: 8px 22px 0 32px; background: var(--bar); font-size: 14px; font-weight: 600; }
.status-icons { display: flex; align-items: center; gap: 5px; }
.app-head { display: flex; flex: none; align-items: center; gap: 8px; padding: 2px 10px 8px; background: var(--bar); border-bottom: 1px solid rgb(0 0 0 / .12); }
.app-input { display: flex; flex: none; align-items: center; gap: 10px; padding: 7px 10px 26px; background: var(--bar); border-top: 1px solid rgb(0 0 0 / .1); color: #8e8e93; }
.back { display: flex; align-items: center; gap: 4px; color: #007aff; font-size: 16px; }
.who { flex: 1; min-width: 0; line-height: 1.2; text-align: center; }
.who b { display: block; overflow: hidden; font-size: 15px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.who small { color: #8e8e93; font-size: 12px; }
.avatar { display: grid; flex: none; place-items: center; width: 34px; height: 34px; background: var(--brand); color: var(--brand-foreground); border-radius: 50%; font-size: 15px; font-style: normal; font-weight: 700; }
.field { flex: 1; padding: 6px 12px; background: #fff; color: #b0b0b5; border: 1px solid #d8d8dc; border-radius: 18px; font-size: 14px; }
.msgs { display: flex; flex: 1; flex-direction: column; justify-content: flex-end; gap: 5px; min-height: 0; padding: 8px 8px 10px; overflow: hidden; }
.day { align-self: center; margin-bottom: 4px; padding: 2px 9px; background: rgb(0 0 0 / .22); color: #fff; border-radius: 10px; font-size: 12px; font-weight: 500; }
.b { position: relative; flex: none; max-width: 82%; padding: 6px 9px 7px; border-radius: 16px; box-shadow: 0 1px 1px rgb(0 0 0 / .1); }
.b.in { align-self: flex-start; background: #fff; border-bottom-left-radius: 5px; }
.b.out { align-self: flex-end; background: var(--out); border-bottom-right-radius: 5px; }
.b time { float: right; display: flex; align-items: center; gap: 2px; margin: 5px 0 -4px 10px; color: #8e8e93; font-size: 11px; }
.b.out time { color: var(--out-time); }
.b.pic, .b.album { padding: 3px; }
.b.pic img { width: 100px; aspect-ratio: 1; object-fit: cover; border-radius: 13px; }
.b.pic time, .b.album time { position: absolute; right: 9px; bottom: 9px; margin: 0; padding: 1px 6px; background: rgb(0 0 0 / .45); color: #fff; border-radius: 9px; }
/* Telegram shows a media group as a mosaic */
.album-grid { display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: 64px 48px 48px; gap: 2px; width: 216px; overflow: hidden; border-radius: 13px; }
.album-grid img { grid-column: span 2; width: 100%; height: 100%; object-fit: cover; }
.album-grid img:nth-child(-n+2) { grid-column: span 3; }
/* The chat plays out message by message */
[data-phase="idle"] .msgs > * { opacity: 0; translate: 0 10px; transition: none; }
[data-phase="play"] .msgs > * { transition: opacity .3s, translate .45s cubic-bezier(.2, .9, .3, 1.2); transition-delay: calc(var(--n, 0) * 650ms); }
@media (prefers-reduced-motion: reduce) { .msgs > * { transition: none !important; } }
</style>

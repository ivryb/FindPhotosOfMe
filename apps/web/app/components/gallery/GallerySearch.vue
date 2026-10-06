<script setup lang="ts">
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { Camera, ChevronDown, ChevronUp, Download, LoaderCircle, ShieldCheck } from "@lucide/vue";
import type { GalleryPhoto } from "#shared/types/gallery";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { SELFIE_TYPES } from "@/composables/useSelfieSearch";

// The selfie search: a banner floating over the gallery that opens into a sheet.
// While a search runs the sheet can be closed; the banner then shows that it's running, and later the result.
const props = defineProps<{ galleryId: Id<"collections">; total: number; owner?: boolean; inline?: boolean; compact?: boolean; shareToken?: string }>();
const emit = defineEmits<{ view: [photos: GalleryPhoto[], index: number] }>();

const { state, search } = useSelfieSearch(() => props.galleryId, { owner: props.owner, shareToken: props.shareToken });
const open = defineModel<boolean>("open", { default: false });
const picker = useTemplateRef("picker");
const camera = useTemplateRef("camera");
const dragging = ref(false);
const total = computed(() => count.format(props.total));

const selfie = computed(() => ("selfie" in state.value ? state.value.selfie : undefined));
const canPick = computed(() => ["idle", "none", "no_face", "unreadable", "failed"].includes(state.value.kind));
// While searching and once photos are found, the whole banner opens the sheet; the side button is for wide screens.
const expandable = computed(() => state.value.kind === "searching" || state.value.kind === "found");

const banner = computed(() => {
  const s = state.value;
  switch (s.kind) {
    case "idle": return { title: "Find photos with you", text: "Upload a photo of your face to see only photos you’re in." };
    case "searching": return { title: "Looking for you", text: `Checking all ${total.value} photos` };
    case "found": return { title: `${s.photos.length} ${s.photos.length === 1 ? "photo" : "photos"} of you`, text: `Found in ${total.value} photos.` };
    case "none": return { title: "No photos of you found", text: "A different selfie can help: one face, in good light." };
    case "no_face": return { title: "No face in this photo", text: "Use a photo where your face is clear." };
    case "unreadable": return { title: "We can’t use this photo", text: s.message };
    case "failed": return { title: "The search didn’t finish", text: "Something went wrong on our side. Try again." };
    case "paused": return { title: "Searching is paused", text: s.message };
  }
});

function choose(input: HTMLInputElement | null) {
  const file = input?.files?.[0];
  if (input) input.value = "";
  if (file) start(file);
}

function start(file: File) {
  open.value = true;
  search(file);
}

function drop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) start(file);
}

// Browsers save each photo from its signed download link; a short pause keeps them from dropping some.
async function downloadAll(photos: GalleryPhoto[]) {
  for (const photo of photos) {
    const link = Object.assign(document.createElement("a"), { href: photo.download, download: "" });
    document.body.append(link);
    link.click();
    link.remove();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
</script>

<template>
  <div>
  <Drawer v-model:open="open">
  <DrawerTrigger v-if="compact" as-child>
    <button type="button" class="gallery-action" aria-label="Find me" :title="banner.title">
      <LoaderCircle v-if="state.kind === 'searching'" class="searching-icon" aria-hidden="true" />
      <Camera v-else aria-hidden="true" /><span>Find me</span>
      <span v-if="state.kind === 'found'" class="found-count">{{ state.photos.length }}</span>
      <span class="sr-only" aria-live="polite">{{ state.kind === 'idle' ? '' : banner.title }}</span>
    </button>
  </DrawerTrigger>
  <div v-else v-show="!open" :class="['banner', { inline }]" :data-state="state.kind" aria-live="polite">
    <button type="button" class="banner-main" aria-haspopup="dialog" @click="open = true">
      <span v-if="selfie" :class="['ring', { done: state.kind !== 'searching' }]"><img :src="selfie" alt="Your selfie"></span>
      <span v-else class="slot"><Camera /></span>
      <span class="banner-text">
        <b>{{ banner.title }}</b>
        <small>{{ banner.text }}</small>
        <span v-if="state.kind === 'searching'" class="working" aria-hidden="true" />
      </span>
      <span v-if="expandable" class="chevron" aria-hidden="true"><ChevronUp /></span>
    </button>
    <div v-if="state.kind !== 'paused'" :class="['banner-side', { expand: expandable }]">
      <span v-if="state.kind === 'found'" class="stack" aria-hidden="true">
        <img v-for="photo in state.photos.slice(0, 3)" :key="photo.key" :src="photo.thumb" alt="">
      </span>
      <Button v-if="state.kind === 'searching'" size="xl" variant="outline" class="banner-button" @click="open = true"><ChevronUp />Show</Button>
      <Button v-else-if="state.kind === 'found'" size="xl" class="banner-button" @click="open = true">See your photos</Button>
      <Button v-else-if="state.kind === 'idle'" size="xl" class="banner-button" @click="open = true">
        <Camera /><span class="wide-only">Search with a selfie</span><span class="narrow-only">Search</span>
      </Button>
      <Button v-else size="xl" class="banner-button" @click="open = true"><Camera />New selfie</Button>
    </div>
  </div>

    <DrawerContent
      :class="['selfie-sheet', { dragging, 'owner-search': owner }]"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="drop"
    >
      <DrawerClose class="selfie-sheet-minimize" aria-label="Minimize"><ChevronDown /></DrawerClose>
      <div class="selfie-sheet-body">
        <div v-if="selfie && state.kind !== 'idle'" class="selfie-sheet-head">
          <span :class="['ring', 'big', { done: state.kind !== 'searching' }]"><img :src="selfie" alt="Your selfie"></span>
          <div>
            <DrawerTitle as="h2">{{ banner.title }}</DrawerTitle>
            <DrawerDescription class="selfie-sheet-sub">
              <template v-if="state.kind === 'none'">We checked all {{ total }} photos. A different selfie can help: one face, looking at the camera, in good light.</template>
              <template v-else-if="state.kind === 'no_face'">Use a photo where your face is clear and looking at the camera.</template>
              <template v-else>{{ banner.text }}</template>
            </DrawerDescription>
          </div>
        </div>
        <div v-else>
          <DrawerTitle as="h2">{{ banner.title }}</DrawerTitle>
          <DrawerDescription class="selfie-sheet-sub">{{ banner.text }}</DrawerDescription>
        </div>

        <template v-if="state.kind === 'searching'">
          <span class="working big" aria-hidden="true" />
          <p class="selfie-sheet-keep">You can keep browsing while we look. <DrawerClose class="selfie-sheet-link">Keep browsing</DrawerClose></p>
        </template>

        <template v-if="state.kind === 'found'">
          <div class="selfie-sheet-actions">
            <Button size="xl" @click="downloadAll(state.photos)"><Download />Download all {{ state.photos.length }}</Button>
            <Button size="xl" variant="outline" @click="picker?.click()">Try another selfie</Button>
          </div>
          <ul class="selfie-sheet-found">
            <li v-for="(photo, index) in state.photos" :key="photo.key">
              <GalleryTile :photo="photo" :label="`Open photo ${index + 1} of you`" @open="emit('view', state.photos, index)" />
            </li>
          </ul>
        </template>

        <template v-if="canPick">
          <div class="selfie-sheet-pick">
            <button type="button" class="selfie-sheet-card" @click="picker?.click()">
              <span class="face-guide"><Camera /></span>
              <b>Choose a photo of your face</b>
              <small>JPEG, PNG, or WebP, up to 10 MB<span class="fine-only">, or drop it here</span></small>
              <ul class="selfie-sheet-tips"><li>One face</li><li>Looking at the camera</li><li>Good light</li></ul>
            </button>
            <Button size="xl" class="touch-only" @click="camera?.click()"><Camera />Take a selfie now</Button>
          </div>
          <div class="selfie-sheet-privacy">
            <ShieldCheck aria-hidden="true" />
            <p><b>Used only for this search</b><span>We don’t save your photo or any data about your face.</span></p>
          </div>
        </template>
      </div>
    </DrawerContent>
  </Drawer>

  <input ref="picker" type="file" :accept="SELFIE_TYPES.join(',')" class="sr-only" tabindex="-1" aria-hidden="true" @change="choose(picker)">
  <input ref="camera" type="file" accept="image/*" capture="user" class="sr-only" tabindex="-1" aria-hidden="true" @change="choose(camera)">
  </div>
</template>

<style scoped>
.searching-icon { animation: searching-turn 1.2s linear infinite; }
.found-count { position: absolute; top: -7px; right: -3px; display: grid; place-items: center; min-width: 26px; height: 26px; padding-inline: 5px; border: 2px solid var(--brand); border-radius: 50%; background: var(--foreground); color: var(--brand); font-size: .8rem; }
@keyframes searching-turn { to { rotate: 1turn; } }
@media (prefers-reduced-motion: reduce) { .searching-icon { animation: none; } }
.banner { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); left: 50%; z-index: 30; display: flex; align-items: center; gap: 16px; width: min(780px, calc(100% - 24px)); padding: 12px; background: var(--brand); color: var(--brand-foreground); border-radius: 18px; box-shadow: 0 24px 48px -16px rgb(0 0 0 / .8); translate: -50% 0; }
.banner.inline { position: static; width: 100%; margin-bottom: 24px; box-shadow: none; translate: none; }
.banner :focus-visible { outline: 3px solid var(--foreground); outline-offset: 2px; }
.banner-main { display: flex; flex: 1; align-items: center; gap: 16px; min-width: 0; padding: 0; color: inherit; text-align: left; border-radius: 10px; cursor: pointer; }
.slot { display: grid; flex: none; place-items: center; width: 64px; height: 64px; border: 2px dashed rgb(21 21 21 / .4); border-radius: 50%; }
.slot svg { width: 26px; height: 26px; }
.banner .ring { width: 64px; height: 64px; }
.banner-text { flex: 1; min-width: 0; line-height: 1.3; }
.banner-text b { display: block; font-size: 1.15rem; font-weight: 800; font-stretch: 112%; }
.banner-text small { display: block; margin-top: 2px; color: #4f4826; font-size: .95rem; }
.banner-text .working { margin-top: 8px; }
.banner-side { display: flex; align-items: center; gap: 14px; }
.stack { display: flex; padding-left: 10px; }
.stack img { width: 44px; height: 44px; margin-left: -10px; object-fit: cover; border: 2px solid var(--brand); border-radius: 8px; }
.chevron, .narrow-only { display: none; }
.chevron svg { width: 22px; height: 22px; }

/* On phones and narrow windows the banner is one slim row, so the photos stay in view.
   Descriptions go, and while searching or once photos are found the whole banner opens the sheet. */
@media (max-width: 760px) {
  .banner { bottom: max(10px, env(safe-area-inset-bottom)); gap: 10px; width: calc(100% - 16px); padding: 8px; border-radius: 16px; }
  .banner-main { gap: 10px; }
  .slot, .banner .ring { width: 44px; height: 44px; }
  .slot svg { width: 20px; height: 20px; }
  .banner-text b { display: -webkit-box; overflow: hidden; font-size: 1rem; line-height: 1.15; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .banner-text small { overflow: hidden; font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
  /* Before a search and after a miss the button carries the camera, so the slot and description go */
  .banner:not([data-state="searching"], [data-state="found"]) :is(small, .slot, .ring) { display: none; }
  .banner:not([data-state="searching"], [data-state="found"]) .banner-main { padding-left: 8px; }
  .banner-text .working { height: 4px; margin-top: 6px; }
  .banner-button { height: 44px; padding-inline: 14px; font-size: .95rem; }
  .wide-only, .stack, .banner-side.expand { display: none; }
  .narrow-only { display: inline; }
  .chevron { display: grid; flex: none; place-items: center; width: 36px; height: 36px; }
}
@media (max-width: 380px) {
  .banner-text b { font-size: .95rem; font-stretch: 100%; }
  .banner-button { padding-inline: 12px; }
  .banner .ring { width: 40px; height: 40px; }
}
</style>

<!-- Not scoped: the sheet is teleported to the end of the page, and the ring and progress bar are shared with it. -->
<style>
.ring { display: grid; flex: none; place-items: center; padding: 3px; background: conic-gradient(var(--foreground) 25%, rgb(21 21 21 / .15) 0); border-radius: 50%; animation: ring-turn 1.2s linear infinite; }
.ring img { width: 100%; height: 100%; object-fit: cover; border: 2px solid var(--brand); border-radius: 50%; }
.ring.done { background: var(--foreground); animation: none; }
.ring.big { width: 72px; height: 72px; padding: 4px; }
@keyframes ring-turn { to { rotate: 1turn; } }
.ring img { animation: ring-hold 1.2s linear infinite; }
.ring.done img { animation: none; }
@keyframes ring-hold { to { rotate: -1turn; } }
.working { position: relative; display: block; height: 6px; overflow: hidden; background: rgb(21 21 21 / .15); border-radius: 3px; }
.working::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 35%; background: var(--foreground); border-radius: 3px; animation: working 1.4s ease-in-out infinite; }
.working.big { margin-top: 20px; }
@keyframes working { from { translate: -100% 0; } to { translate: 300% 0; } }

.selfie-sheet.selfie-sheet { inset: auto 0 16px; width: min(780px, calc(100% - 32px)); max-height: min(86vh, 860px); margin: 0 auto; background: var(--brand); color: var(--brand-foreground); border-radius: 24px; box-shadow: 0 30px 80px -20px rgb(0 0 0 / .8); }
.selfie-sheet.dragging { outline: 3px solid var(--foreground); outline-offset: -3px; }
.selfie-sheet :focus-visible { outline: 3px solid var(--foreground); outline-offset: 2px; }
.selfie-sheet-minimize { position: absolute; top: 20px; right: 20px; z-index: 2; display: grid; place-items: center; width: 44px; height: 44px; background: #efc61d; border-radius: 50%; cursor: pointer; }
.selfie-sheet-minimize:hover { background: #e6bd14; }
.selfie-sheet-minimize svg { width: 22px; height: 22px; }
.selfie-sheet-body { display: flex; flex: 1; flex-direction: column; overflow-y: auto; padding: 26px 32px 32px; }
.selfie-sheet-body > :first-child { padding-right: 56px; }
.selfie-sheet h2 { font-size: clamp(1.9rem, 4vw, 2.4rem); font-weight: 800; }
.selfie-sheet-head { display: flex; align-items: center; gap: 18px; }
.selfie-sheet-sub { margin-top: 8px; color: #4f4826; font-size: 1.05rem; }
.selfie-sheet-keep { margin-top: 22px; color: #4f4826; }
.selfie-sheet-link { color: var(--foreground); font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; cursor: pointer; }
.selfie-sheet-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.selfie-sheet-actions > * { flex: 1 1 200px; }
.selfie-sheet-found { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(170px, 30%), 1fr)); gap: 6px; margin-top: 22px; }
.selfie-sheet-found li { aspect-ratio: 4 / 3; overflow: hidden; border-radius: 6px; animation: found-pop .45s cubic-bezier(.2, .9, .3, 1.2) both; }
@keyframes found-pop { from { opacity: 0; scale: .85; } }

.selfie-sheet-pick { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
.selfie-sheet-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 28px 20px 24px; background: var(--background); color: var(--foreground); border-radius: 18px; text-align: center; cursor: pointer; transition: box-shadow .2s; }
.selfie-sheet-card:hover { box-shadow: 0 14px 30px -16px rgb(0 0 0 / .45); }
.selfie-sheet-card .face-guide { display: grid; place-items: center; width: 84px; height: 84px; margin-bottom: 12px; border: 2px dashed #b4b4ae; border-radius: 50%; transition: border-color .2s; }
.selfie-sheet-card:hover .face-guide { border-color: var(--foreground); }
.selfie-sheet-card .face-guide svg { width: 30px; height: 30px; }
.selfie-sheet-card b { font-size: 1.2rem; font-weight: 800; font-stretch: 112%; }
.selfie-sheet-card small { color: var(--muted-foreground); font-size: .92rem; }
.selfie-sheet-tips { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 18px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); font-size: .9rem; }
.selfie-sheet-tips li::before { content: "✓ "; font-weight: 800; }
/* What happens to the selfie, said before anyone uploads one */
.selfie-sheet-privacy { display: flex; align-items: flex-start; justify-content: center; gap: 12px; margin-block: 28px 8px; line-height: 1.35; }
.selfie-sheet-privacy svg { flex: none; width: 22px; height: 22px; margin-top: 1px; }
.selfie-sheet-privacy b { display: block; font-weight: 700; }
.selfie-sheet-privacy span { color: #4f4826; font-size: .92rem; }
@media (pointer: fine) { .selfie-sheet .touch-only { display: none; } }
@media (pointer: coarse) { .selfie-sheet .fine-only { display: none; } }

@media (max-width: 900px) { .selfie-sheet.owner-search h2 { font-size: 1.5rem; } }
@media (max-width: 640px) {
  /* The sheet opens to most of the screen, so its first lines sit where people read */
  .selfie-sheet.selfie-sheet { inset: auto 0 0; width: 100%; min-height: 82dvh; max-height: 92dvh; border-radius: 24px 24px 0 0; }
  .selfie-sheet-minimize { top: 28px; right: 16px; }
  .selfie-sheet-body { padding: 8px 20px max(20px, env(safe-area-inset-bottom)); }
  .selfie-sheet-privacy { justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .ring, .ring img, .working::after, .selfie-sheet-found li { animation: none; }
}
</style>

<script setup lang="ts">
import { useDropZone } from "@vueuse/core";
import { Camera, Download, ShieldCheck } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { SELFIE_TYPES, downloadAll } from "@/composables/useSelfieSearch";
import type { Gallery } from "@/utils/galleries";

// The Search tab: the owner finds someone from a photo of their face, and the photos they're in open right here.
const props = defineProps<{ gallery: Gallery }>();

const { state, search } = useSelfieSearch(() => props.gallery._id, { owner: true });
const total = computed(() => count.format(props.gallery.imagesCount));
const picker = useTemplateRef("picker");
// A photo dropped anywhere on the tab starts a search.
const tab = useTemplateRef("tab");
const { isOverDropZone: over } = useDropZone(tab, (files) => {
  if (props.gallery.imagesCount && state.value.kind !== "searching") choose(files?.[0]);
});
const viewer = reactive({ open: false, index: 0 });

function view(index: number) {
  Object.assign(viewer, { open: true, index });
}

function choose(file: File | undefined) {
  if (file) search(file);
  if (picker.value) picker.value.value = "";
}

// The headline once a photo is chosen. Before that, and after a search that found nothing, the drop zone asks for one.
const outcome = computed(() => {
  const s = state.value;
  switch (s.kind) {
    case "idle": return undefined;
    case "searching": return { title: "Looking for this person", text: `Checking all ${total.value} photos` };
    case "found": return { title: `${count.format(s.photos.length)} ${s.photos.length === 1 ? "photo" : "photos"} of this person`, text: `Found in ${total.value} photos` };
    case "none": return { title: "No photos of this person", text: "A different photo can help: one face, looking at the camera, in good light." };
    case "no_face": return { title: "No face in this photo", text: "Use a photo where the face is clear and looking at the camera." };
    case "unreadable": return { title: "We can’t use this photo", text: s.message };
    case "failed": return { title: "The search didn’t finish", text: "Something went wrong on our side. Try again." };
    case "paused": return { title: "Searching is paused", text: s.message };
    default: {
      const exhaustive: never = s;
      return exhaustive;
    }
  }
});
const asking = computed(() => state.value.kind !== "searching" && state.value.kind !== "found");
</script>

<template>
  <div ref="tab">
    <DashboardCard title="Search">
      <template #aside><p>{{ total }} photos ready to search</p></template>
      <div v-if="gallery.imagesCount">
        <div v-if="outcome" class="outcome" aria-live="polite">
          <span v-if="'selfie' in state" class="face"><img :src="state.selfie" alt="The photo searched with"></span>
          <div class="outcome-text">
            <h3>{{ outcome.title }}</h3>
            <p>{{ outcome.text }}</p>
          </div>
          <div v-if="state.kind === 'found'" class="outcome-actions">
            <Button size="sm" @click="downloadAll(state.photos)"><Download />Download all {{ state.photos.length }}</Button>
            <Button size="sm" variant="outline" @click="picker?.click()">New search</Button>
          </div>
        </div>
        <span v-if="state.kind === 'searching'" class="working" aria-hidden="true" />
        <ul v-if="state.kind === 'found'" class="found">
          <li v-for="(photo, index) in state.photos" :key="photo.key">
            <GalleryTile :photo="photo" :label="`Open photo ${index + 1}`" @open="view(index)" />
          </li>
        </ul>
        <template v-if="asking">
          <button type="button" :class="['drop', { over }]" @click="picker?.click()">
            <span class="slot"><Camera /></span>
            <span class="drop-text"><b>Find someone in this gallery</b><small>Drop a photo of their face here, or choose one. One face, looking at the camera, works best.</small></span>
            <span class="choose">Choose photo</span>
          </button>
          <p class="privacy"><ShieldCheck aria-hidden="true" />The photo is used only for this search. We don’t keep it.</p>
        </template>
        <input ref="picker" type="file" :accept="SELFIE_TYPES.join(',')" hidden @change="choose(($event.target as HTMLInputElement).files?.[0])">
        <GalleryViewer v-if="state.kind === 'found'" v-model:open="viewer.open" :index="viewer.index" :photos="state.photos" />
      </div>
      <p v-else class="text-muted-foreground">Photos will be searchable once they finish processing. <NuxtLink :to="{ query: {} }" class="font-semibold text-foreground underline underline-offset-4" replace>Upload photos</NuxtLink> to get started.</p>
    </DashboardCard>
  </div>
</template>

<style scoped>
.drop { display: flex; align-items: center; gap: 18px; width: 100%; padding: 18px; border: 2px dashed #c2c2bd; border-radius: 10px; text-align: left; cursor: pointer; transition: border-color .2s, background-color .2s; }
.drop:hover, .drop.over { background: var(--accent); border-color: var(--foreground); }
.slot { display: grid; flex: none; place-items: center; width: 64px; height: 64px; border: 2px dashed #c2c2bd; border-radius: 50%; color: var(--muted-foreground); }
.slot svg { width: 26px; height: 26px; }
.drop-text { flex: 1; }
.drop b { display: block; font-size: 1.1rem; font-weight: 800; font-stretch: 110%; }
.drop small { display: block; max-width: 56ch; color: var(--muted-foreground); font-size: .9rem; }
.choose { flex: none; padding: 8px 14px; border: 2px solid var(--foreground); border-radius: 6px; font-size: .92rem; font-weight: 700; }
.privacy { display: flex; align-items: center; gap: 8px; margin-top: 12px; color: var(--muted-foreground); font-size: .86rem; }
.privacy svg { flex: none; width: 16px; height: 16px; }

.outcome { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 18px; }
.face { flex: none; width: 52px; height: 52px; overflow: hidden; border: 3px solid var(--brand); border-radius: 50%; }
.face img { width: 100%; height: 100%; object-fit: cover; }
.outcome-text { flex: 1 1 260px; }
.outcome h3 { font-size: 1.3rem; font-weight: 800; font-stretch: 112%; letter-spacing: -.01em; }
.outcome p { color: var(--muted-foreground); font-size: .92rem; }
.outcome-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.working { position: relative; display: block; height: 6px; overflow: hidden; background: var(--muted); border-radius: 3px; }
.working::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 35%; background: var(--foreground); border-radius: 3px; animation: working 1.4s ease-in-out infinite; }
@keyframes working { from { translate: -100% 0; } to { translate: 300% 0; } }
.found { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.found li { aspect-ratio: 4 / 3; overflow: hidden; border-radius: 6px; animation: pop .4s cubic-bezier(.2, .9, .3, 1.2) both; }
@keyframes pop { from { opacity: 0; scale: .9; } }
@media (max-width: 600px) {
  .drop { flex-wrap: wrap; }
  .slot { width: 48px; height: 48px; }
  .choose { margin-left: 66px; }
}
@media (prefers-reduced-motion: reduce) { .working::after, .found li { animation: none; } }
</style>

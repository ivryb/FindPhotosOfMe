<script setup lang="ts">
import { Upload, ChevronDown, CircleAlert, CircleCheck, CircleDashed, LoaderCircle } from "@lucide/vue";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Doc, Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { useConvexClient } from "convex-vue";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import type { Sending } from "@/composables/usePhotoUpload";

// `browse` says whether guests can scroll the whole gallery; without it they find their photos by searching.
const props = defineProps<{ galleryId: Id<"collections">; shareToken?: string; browse: boolean }>();
const open = defineModel<boolean>("open", { default: false });
const dragging = ref(false);
const picker = useTemplateRef("picker");
const contributorKey = ref("");
const access = computed(() => ({ shareToken: props.shareToken, contributorKey: contributorKey.value }));
const uploads = ref<Doc<"uploads">[]>([]);
const { sending, uploading, upload } = usePhotoUpload(() => props.galleryId, uploads, access);
const failure = ref("");
const convex = useConvexClient();
let unsubscribe: (() => void) | undefined;
onMounted(() => {
  const storageKey = `gallery-contributor:${props.galleryId}`;
  // Storage may be disabled in private browsers; uploads still work for this visit.
  try { contributorKey.value = localStorage.getItem(storageKey) ?? ""; } catch {}
  if (!/^[a-f0-9]{32}$/.test(contributorKey.value)) contributorKey.value = crypto.randomUUID().replaceAll("-", "");
  try { localStorage.setItem(storageKey, contributorKey.value); } catch {}
  unsubscribe = convex.onUpdate(api.uploads.list, { collectionId: props.galleryId, access: access.value },
    (value) => { uploads.value = value; failure.value = ""; },
    () => { failure.value = "Uploads are unavailable. Refresh the page to check whether the owner has closed contributions."; });
});
onUnmounted(() => unsubscribe?.());

const ready = computed(() => Boolean(contributorKey.value) && !failure.value);
function add(files: FileList | null | undefined) {
  if (files?.length && ready.value) upload(Array.from(files));
  if (picker.value) picker.value.value = "";
}

const photos = (n: number) => `${count.format(n)} ${n === 1 ? "photo" : "photos"}`;
const icons = { busy: LoaderCircle, waiting: CircleDashed, done: CircleCheck, error: CircleAlert };
type Row = { key: string; name: string; text: string; tone: keyof typeof icons; progress?: number };
// The guest's uploads, newest first, with what this tab is sending laid over them so rows keep their place as they
// finish. Files Convex doesn't know yet (opening, waiting, or refused) lead.
const rows = computed<Row[]>(() => [
  ...sending.value.filter((entry) => !uploads.value.some((item) => item._id === entry.uploadId)).map(sendingRow),
  ...uploads.value.map((item) => {
    const here = sending.value.find((entry) => entry.uploadId === item._id);
    return here ? sendingRow(here) : uploadRow(item);
  }),
]);

function sendingRow(entry: Sending): Row {
  const row = { key: entry.uploadId ?? entry.key, name: entry.name };
  if (entry.error) return { ...row, tone: "error", text: entry.error };
  if (!entry.photos) return { ...row, tone: "busy", text: "Opening your photos…" };
  // Read, and waiting for the upload ahead of it: this tab sends one at a time.
  if (!entry.uploadId) return { ...row, tone: "waiting", text: "Waiting to upload" };
  return { ...row, tone: "busy", text: `${count.format(entry.sent)} of ${photos(entry.photos)} uploaded`, progress: entry.sent / entry.photos };
}

// A guest is done once their photos reach storage. Processing runs on our side and can take a while, so it isn't
// shown as something to wait for.
function uploadRow(item: Doc<"uploads">): Row {
  const row = { key: item._id, name: item.name };
  if (item.sent < item.photos) return { ...row, tone: "error", text: `${count.format(item.sent)} of ${photos(item.photos)} uploaded. Choose the same files to continue.` };
  if (item.processed < item.photos) return { ...row, tone: "done", text: props.browse ? "Uploaded. Your photos will appear in the gallery as they’re processed, which can take a while." : "Uploaded. Once they’re processed, which can take a while, search with a selfie to find the ones you’re in." };
  const missing = item.processed - item.saved;
  return { ...row, tone: item.saved ? "done" : "error", text: `${photos(item.saved)} added to the gallery${missing ? `. ${count.format(missing)} couldn’t be processed` : ""}.` };
}
</script>

<template>
  <Drawer v-model:open="open">
    <DrawerTrigger as-child>
      <button class="gallery-action" type="button">
        <LoaderCircle v-if="uploading" class="uploading-icon" aria-hidden="true" /><Upload v-else aria-hidden="true" />
        <span>Add photos</span>
        <span v-if="uploading" class="sr-only">, uploading</span>
      </button>
    </DrawerTrigger>
    <DrawerContent :class="['upload-sheet', { dragging }]" @dragover.prevent="dragging = true" @dragleave="dragging = false"
      @drop.prevent="dragging = false; add($event.dataTransfer?.files)">
      <DrawerClose class="upload-sheet-close" aria-label="Close uploads"><ChevronDown /></DrawerClose>
      <section id="guest-upload" class="upload-sheet-body">
        <!-- Guests looking for themselves uploaded selfies here, so this says what it's for and points to Find me. -->
        <DrawerTitle as="h2">Add your photos to this gallery</DrawerTitle>
        <DrawerDescription class="description">Share photos you took at the event. Everyone with access to this gallery can see and download them. No account needed. Looking for photos of yourself? Use Find me instead.</DrawerDescription>
        <p v-if="failure" class="failure" role="alert">{{ failure }}</p>
        <!-- Once photos are chosen, their progress leads and choosing more steps back. -->
        <ul v-if="rows.length" class="progress" aria-live="polite">
          <li v-for="row in rows" :key="row.key" :class="row.tone">
            <component :is="icons[row.tone]" class="status" aria-hidden="true" />
            <b>{{ row.name }}</b>
            <span>{{ row.text }}</span>
            <span v-if="row.progress !== undefined" class="meter"><i :style="{ width: `${row.progress * 100}%` }" /></span>
          </li>
        </ul>
        <Button v-if="rows.length" size="xl" variant="outline" class="add" :disabled="!ready" @click="picker?.click()">
          <Upload aria-hidden="true" />Add more photos
        </Button>
        <button v-else class="drop" type="button" :disabled="!ready" @click="picker?.click()">
          <Upload aria-hidden="true" /><b>Choose photos or ZIPs</b><span>Or drop them here. JPEG or PNG, up to 50 MB each.</span>
        </button>
        <input ref="picker" type="file" accept=".zip,application/zip,image/jpeg,image/png" multiple hidden @change="add(($event.target as HTMLInputElement).files)">
        <p v-if="uploading || !rows.length" class="hint">Keep this tab open while your photos upload. You can close this sheet and keep browsing.</p>
      </section>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.uploading-icon, .busy .status { animation: uploading-turn 1.2s linear infinite; }
@keyframes uploading-turn { to { rotate: 1turn; } }
.upload-sheet-close { position: absolute; top: 20px; right: 20px; z-index: 2; display: grid; place-items: center; width: 44px; height: 44px; background: #efc61d; border-radius: 50%; cursor: pointer; }
.upload-sheet-close:hover { background: #e6bd14; }
.upload-sheet-close svg { width: 22px; height: 22px; }
.upload-sheet-body { overflow-y: auto; padding: 26px 32px 32px; }
.upload-sheet-body h2 { padding-right: 56px; font-size: clamp(1.9rem, 4vw, 2.4rem); font-weight: 800; }
.description { max-width: 60ch; margin-top: 8px; color: #4f4826; font-size: 1.05rem; }
.drop { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; margin-top: 24px; padding: 28px 20px; background: var(--background); color: var(--foreground); border: 2px dashed #b4b4ae; border-radius: 18px; text-align: center; cursor: pointer; }
.drop:hover { border-color: var(--foreground); }
.drop > svg { width: 32px; height: 32px; margin-bottom: 6px; }
.drop:disabled { opacity: .5; cursor: default; }
.drop b { font-size: 1.2rem; font-weight: 800; }
.drop span { font-size: .92rem; color: var(--muted-foreground); }
.add { width: 100%; margin-top: 20px; }
.hint { margin-top: 16px; color: #4f4826; font-size: .9rem; }
.failure { margin-top: 16px; color: #8a2218; }
/* Each upload's icon stands beside both of its lines, so the name and status share one edge. */
.progress { margin-top: 22px; border-bottom: 1px solid rgb(21 21 21 / .2); }
.progress li { display: grid; grid-template-columns: 22px 1fr; gap: 3px 12px; padding-block: 14px; border-top: 1px solid rgb(21 21 21 / .2); overflow-wrap: anywhere; }
.progress li > :not(.status) { grid-column: 2; }
.progress .status { grid-row: 1; width: 22px; height: 22px; margin-top: 1px; }
.progress li span { color: #4f4826; font-size: .92rem; }
.progress .done span { color: var(--brand-foreground); }
.progress .waiting .status { opacity: .5; }
.progress .error :is(.status, span) { color: #8a2218; }
.meter { display: block; height: 6px; margin-top: 7px; overflow: hidden; background: rgb(21 21 21 / .15); border-radius: 3px; }
.meter i { display: block; height: 100%; background: var(--foreground); border-radius: inherit; transition: width .3s; }
@media (max-width: 640px) {
  .upload-sheet-close { top: 28px; right: 16px; }
  .upload-sheet-body { padding: 18px 20px max(24px, env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion: reduce) { .uploading-icon, .busy .status, .meter i { animation: none; transition: none; } }
</style>

<!-- DrawerContent teleports its root outside this component's scoped styles. -->
<style>
.upload-sheet.upload-sheet { inset: auto 0 16px; width: min(780px, calc(100% - 32px)); max-height: min(86dvh, 860px); margin: 0 auto; background: var(--brand); color: var(--brand-foreground); border-radius: 24px; box-shadow: 0 30px 80px -20px rgb(0 0 0 / .8); }
.upload-sheet.dragging { outline: 3px solid var(--foreground); outline-offset: -3px; }
.upload-sheet :focus-visible { outline: 3px solid var(--foreground); outline-offset: 2px; }
@media (max-width: 640px) {
  .upload-sheet.upload-sheet { inset: auto 0 0; width: 100%; max-height: 92dvh; border-radius: 24px 24px 0 0; }
}
</style>

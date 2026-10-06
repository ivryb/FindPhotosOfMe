<script setup lang="ts">
import { Upload, ChevronDown, LoaderCircle } from "@lucide/vue";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Doc, Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { useConvexClient } from "convex-vue";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

const props = defineProps<{ galleryId: Id<"collections">; shareToken?: string }>();
const open = defineModel<boolean>("open", { default: false });
const over = ref(false);
const picker = useTemplateRef("picker");
const contributorKey = ref("");
const access = computed(() => ({ shareToken: props.shareToken, contributorKey: contributorKey.value }));
const { sending, upload } = usePhotoUpload(() => props.galleryId, access);
const uploads = ref<Doc<"uploads">[]>([]);
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

function add(files: FileList | null | undefined) {
  if (files?.length && contributorKey.value) upload(Array.from(files));
  if (picker.value) picker.value.value = "";
}
const rows = computed(() => [
  ...sending.value.map((entry) => ({
    key: entry.key, name: entry.name,
    text: entry.error || (entry.photos ? `${entry.sent} of ${entry.photos} photos uploaded` : "Opening your photos…"),
    error: Boolean(entry.error),
  })),
  ...uploads.value.filter((item) => !sending.value.some((entry) => entry.uploadId === item._id)).map((item) => ({
    key: item._id, name: item.name, error: item.processed === item.photos && item.saved < item.photos,
    text: item.sent < item.photos ? `${item.sent} of ${item.photos} uploaded. Choose the same files to continue.`
      : item.processed < item.photos ? `Processing ${item.photos} photos. They’ll appear here as they’re ready.`
        : `${item.saved} photos added${item.processed > item.saved ? `; ${item.processed - item.saved} couldn’t be processed` : ""}.`,
  })),
]);
const busy = computed(() => sending.value.some((entry) => !entry.error) || uploads.value.some((item) => item.sent === item.photos && item.processed < item.photos));
</script>

<template>
  <Drawer v-model:open="open">
    <DrawerTrigger as-child>
      <button class="gallery-action" type="button" aria-label="Upload your photos">
        <LoaderCircle v-if="busy" class="uploading-icon" aria-hidden="true" /><Upload v-else aria-hidden="true" />
        <span>Upload your photos</span>
        <span v-if="busy" class="sr-only">Photos uploading or processing</span>
      </button>
    </DrawerTrigger>
    <DrawerContent class="upload-sheet">
      <DrawerClose class="upload-sheet-close" aria-label="Close uploads"><ChevronDown /></DrawerClose>
      <section id="guest-upload" class="upload-sheet-body">
        <DrawerTitle as="h2">Upload your photos of this event</DrawerTitle>
        <DrawerDescription class="description">Everyone with access to this gallery can see and download your photos. No account needed.</DrawerDescription>
        <button class="drop" :class="{ over }" type="button" :disabled="!contributorKey || Boolean(failure)"
          @click="picker?.click()" @dragover.prevent="over = true" @dragleave="over = false"
          @drop.prevent="over = false; add($event.dataTransfer?.files)">
          <Upload aria-hidden="true" /><b>Choose photos or ZIPs</b><span>Or drop them here. JPEG or PNG, up to 50 MB each.</span>
        </button>
        <input ref="picker" type="file" accept=".zip,application/zip,image/jpeg,image/png" multiple hidden @change="add(($event.target as HTMLInputElement).files)">
        <p class="hint">Keep this tab open until uploading finishes. You can close this sheet and keep browsing.</p>
        <p v-if="failure" class="error" role="alert">{{ failure }}</p>
        <ul v-if="rows.length" class="progress" aria-live="polite">
          <li v-for="row in rows" :key="row.key"><b>{{ row.name }}</b><span :class="{ error: row.error }">{{ row.text }}</span></li>
        </ul>
      </section>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.uploading-icon { animation: uploading-turn 1.2s linear infinite; }
@keyframes uploading-turn { to { rotate: 1turn; } }
.upload-sheet-close { position: absolute; top: 20px; right: 20px; z-index: 2; display: grid; place-items: center; width: 44px; height: 44px; background: #efc61d; border-radius: 50%; cursor: pointer; }
.upload-sheet-close:hover { background: #e6bd14; }
.upload-sheet-close svg { width: 22px; height: 22px; }
.upload-sheet-body { overflow-y: auto; padding: 26px 32px 32px; }
.upload-sheet-body h2 { padding-right: 56px; font-size: clamp(1.9rem, 4vw, 2.4rem); font-weight: 800; }
.description { max-width: 60ch; margin-top: 8px; color: #4f4826; font-size: 1.05rem; }
.drop { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; margin-top: 24px; padding: 28px 20px; background: var(--background); color: var(--foreground); border: 2px dashed #b4b4ae; border-radius: 18px; text-align: center; cursor: pointer; }
.drop:hover, .drop.over { border-color: var(--foreground); }
.drop > svg { width: 32px; height: 32px; margin-bottom: 6px; }
.drop:disabled { opacity: .5; cursor: default; }
.drop b { font-size: 1.2rem; font-weight: 800; }
.drop span { font-size: .92rem; color: var(--muted-foreground); }
.hint { margin-top: 16px; color: #4f4826; font-size: .9rem; }
.progress { margin-top: 20px; }
.progress li { display: grid; gap: 4px; padding-block: 12px; border-top: 1px solid rgb(21 21 21 / .2); overflow-wrap: anywhere; }
.progress span { color: #4f4826; font-size: .9rem; }
.error, .progress .error { color: #8a2218; }
@media (max-width: 640px) {
  .upload-sheet-close { top: 28px; right: 16px; }
  .upload-sheet-body { padding: 18px 20px max(24px, env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion: reduce) { .uploading-icon { animation: none; } }
</style>

<!-- DrawerContent teleports its root outside this component's scoped styles. -->
<style>
.upload-sheet.upload-sheet { inset: auto 0 16px; width: min(780px, calc(100% - 32px)); max-height: min(86dvh, 860px); margin: 0 auto; background: var(--brand); color: var(--brand-foreground); border-radius: 24px; box-shadow: 0 30px 80px -20px rgb(0 0 0 / .8); }
.upload-sheet :focus-visible { outline: 3px solid var(--foreground); outline-offset: 2px; }
@media (max-width: 640px) {
  .upload-sheet.upload-sheet { inset: auto 0 0; width: 100%; max-height: 92dvh; border-radius: 24px 24px 0 0; }
}
</style>

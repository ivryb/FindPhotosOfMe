<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { coveredBy } from "@FindPhotosOfMe/backend/convex/pricing";
import { useConvexQuery } from "convex-vue";
import { Upload } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import type { Sending } from "@/composables/usePhotoUpload";
import type { Gallery, StatusTone } from "@/utils/galleries";

// The Upload photos tab: a sheet of tiles showing what's ready, what's being processed, and what the balance still covers, then uploads.
const props = defineProps<{ gallery: Gallery; credit: number }>();
const emit = defineEmits<{ topUp: [] }>();

const { data: uploads } = useConvexQuery(api.uploads.list, { collectionId: props.gallery._id }, { server: false });
const { sending, upload } = usePhotoUpload(() => props.gallery._id);

const ready = computed(() => props.gallery.imagesCount);
const busy = computed(() => (uploads.value ?? []).reduce((sum, item) => sum + item.sent - item.processed, 0));
const covered = computed(() => coveredBy(props.credit, "photo"));

// One tile stands for `unit` photos, picked so the sheet never has more than 120 tiles.
const unit = computed(() => [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].find((size) => (ready.value + busy.value + covered.value) / size <= 120) ?? 10000);
const tiles = computed(() => {
  const readyTiles = Math.round(ready.value / unit.value);
  const busyTiles = busy.value ? Math.max(1, Math.round(busy.value / unit.value)) : 0;
  const total = Math.max(1, readyTiles + busyTiles + Math.round(covered.value / unit.value));
  return Array.from({ length: total }, (_, n) => (n < readyTiles ? "ready" : n < readyTiles + busyTiles ? "busy" : ""));
});

const blocked = computed(() => {
  if (props.gallery.paymentStatus === "refunded") return "This gallery was refunded, so it can't take more photos.";
  if (props.gallery.expiresAt && props.gallery.expiresAt <= Date.now()) return "This gallery is offline. Bring it back online to add photos.";
  return undefined;
});

const picker = useTemplateRef("picker");
const over = ref(false);
function add(files: FileList | null | undefined) {
  if (files?.length) upload(Array.from(files));
  if (picker.value) picker.value.value = "";
}

type Row = { key: string; name: string; when?: number; label: string; tone: StatusTone; note: string; progress?: number };

// Uploads Convex knows, with what this tab is sending laid over them, after files still being opened here.
const rows = computed<Row[]>(() => [
  ...sending.value.filter((entry) => !entry.uploadId).map(openingRow),
  ...(uploads.value ?? []).map((item) => uploadRow(item, sending.value.find((entry) => entry.uploadId === item._id))),
]);

function openingRow(entry: Sending): Row {
  const row = { key: entry.key, name: entry.name };
  if (entry.error) return { ...row, label: "Not added", tone: "bad", note: entry.error };
  // Read and waiting for the uploads ahead of it, which go one at a time
  if (entry.photos) return { ...row, label: "Waiting", tone: "idle", note: "Starts after the current upload" };
  return { ...row, label: "Opening", tone: "busy", note: "Reading the files" };
}

function uploadRow(item: Doc<"uploads">, here?: Sending): Row {
  const row = { key: item._id, name: item.name, when: item._creationTime };
  const of = (done: number) => `${count.format(done)} of ${count.format(item.photos)} photos`;
  if (here?.error) return { ...row, label: "Stopped", tone: "bad", note: here.error };
  if (here) {
    const skipped = here.tooLarge ? `. ${count.format(here.tooLarge)} over 50 MB were skipped` : "";
    return { ...row, label: "Uploading", tone: "busy", note: `${of(here.sent)} sent${skipped}`, progress: here.sent / item.photos };
  }
  if (item.sent < item.photos) return { ...row, label: "Stopped", tone: "idle", note: `${of(item.sent)} sent. Add ${item.name} again to continue.` };
  if (item.processed < item.photos) return { ...row, label: "Finding faces", tone: "busy", note: of(item.processed), progress: item.processed / item.photos };
  const leftOut = item.processed - item.saved - item.failed;
  return {
    ...row, label: "Ready", tone: "ok",
    note: [
      `${count.format(item.saved)} photos added`,
      leftOut && `${count.format(leftOut)} photos were left out and not charged`,
      item.failed && `${count.format(item.failed)} couldn't be processed and were refunded`,
    ].filter(Boolean).join(". "),
  };
}
</script>

<template>
  <DashboardCard title="Upload photos">
    <template #aside><p><b>{{ count.format(ready + busy) }}</b> photos</p></template>
    <div class="sheet" role="img" :aria-label="`${count.format(ready)} photos ready, ${count.format(busy)} having faces found, your balance covers ${count.format(covered)} more`">
      <i v-for="(tile, n) in tiles" :key="n" :class="tile" :style="{ '--n': n % 20 }" />
    </div>
    <p class="legend">
      <span class="ready">{{ count.format(ready) }} ready</span>
      <span v-if="busy" class="busy">{{ count.format(busy) }} finding faces</span>
      <span v-if="covered">Your balance covers {{ count.format(covered) }} more</span>
      <em>Each tile is {{ unit === 1 ? "1 photo" : `${count.format(unit)} photos` }}</em>
    </p>

    <div class="actions">
      <p v-if="blocked" class="note">{{ blocked }}</p>
      <div v-else-if="!covered" class="note">
        <p><b>Your balance is out of photos.</b> Top up to add more to this gallery.</p>
        <Button size="sm" @click="emit('topUp')">Top up</Button>
      </div>
      <button
        v-else
        type="button"
        :class="['drop', { over }]"
        @click="picker?.click()"
        @dragover.prevent="over = true"
        @dragleave="over = false"
        @drop.prevent="over = false; add($event.dataTransfer?.files)"
      >
        <Upload />
        <span><b>Add photos</b><small>Drop ZIP files or photos here, or choose them. JPEG or PNG, up to 50 MB per photo. Keep this tab open while they upload. {{ gallery.crowdsource ? "All valid photos are kept, including photos without faces." : "Photos without faces are left out and not charged." }}</small></span>
      </button>
      <input ref="picker" type="file" accept=".zip,application/zip,image/jpeg,image/png" multiple hidden @change="add(($event.target as HTMLInputElement).files)">
    </div>

    <ul v-if="rows.length" class="uploads">
      <li v-for="row in rows" :key="row.key">
        <p><b>{{ row.name }}</b><span v-if="row.when">{{ shortDate.format(row.when) }}</span></p>
        <div>
          <DashboardPill :tone="row.tone">{{ row.label }}</DashboardPill>
          <span class="note-text">{{ row.note }}</span>
          <span v-if="row.progress !== undefined" class="meter"><i :style="{ width: `${row.progress * 100}%` }" /></span>
        </div>
      </li>
    </ul>
  </DashboardCard>
</template>

<style scoped>
.sheet { display: grid; grid-template-columns: repeat(20, minmax(0, 1fr)); gap: 3px; }
.sheet i { aspect-ratio: 3 / 2; background: var(--muted); border-radius: 2px; transition: background-color .3s; }
.sheet i.ready { background: var(--foreground); }
.sheet i.busy { background: var(--brand); animation: pulse 1.6s ease-in-out infinite; animation-delay: calc(var(--n) * 40ms); }
@media (max-width: 600px) { .sheet { grid-template-columns: repeat(10, minmax(0, 1fr)); } }
@keyframes pulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .sheet i.busy { animation: none; } }

.legend { display: flex; flex-wrap: wrap; gap: 6px 22px; margin-top: 14px; font-size: .92rem; }
.legend span { display: inline-flex; align-items: center; gap: 8px; }
.legend span::before { content: ""; width: 14px; height: 10px; background: var(--muted); border-radius: 2px; }
.legend .ready::before { background: var(--foreground); }
.legend .busy::before { background: var(--brand); }
.legend em { margin-left: auto; color: var(--muted-foreground); font-style: normal; }

.actions { margin-top: 24px; }
.drop { display: flex; align-items: flex-start; gap: 14px; width: 100%; padding: 18px; border: 2px dashed #c2c2bd; border-radius: 10px; text-align: left; cursor: pointer; transition: border-color .2s, background-color .2s; }
.drop:hover, .drop.over { background: var(--accent); border-color: var(--foreground); }
.drop svg { flex: none; width: 28px; height: 28px; }
.drop b { display: block; font-size: 1.1rem; font-weight: 800; font-stretch: 110%; }
.drop small { display: block; max-width: 60ch; color: var(--muted-foreground); font-size: .88rem; }
.note { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; padding: 18px 20px; background: var(--accent); border: 2px solid var(--brand); border-radius: 10px; }

.uploads { margin-top: 14px; }
.uploads li { display: grid; gap: 6px; padding-block: 14px; border-top: 1px solid var(--border); }
.uploads li > p { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; }
.uploads li > p b { overflow-wrap: anywhere; }
.uploads li > p span { color: var(--muted-foreground); font-size: .88rem; }
.uploads li > div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.note-text { color: var(--muted-foreground); font-size: .9rem; }
.meter { flex: 1 0 100%; height: 6px; overflow: hidden; background: var(--muted); border-radius: 3px; }
.meter i { display: block; height: 100%; background: var(--foreground); border-radius: inherit; transition: width .3s; }
</style>

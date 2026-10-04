<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { coveredBy } from "@FindPhotosOfMe/backend/convex/pricing";
import { useConvexMutation, useConvexQuery } from "convex-vue";
import { RotateCcw, Upload } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import type { Gallery, StatusTone } from "@/utils/galleries";

// The Photos tab: a sheet of tiles showing what's ready, what's being processed, and what the balance still covers, then uploads.
const props = defineProps<{ gallery: Gallery; credit: number }>();
const emit = defineEmits<{ topUp: [] }>();

const { data: jobs } = useConvexQuery(api.ingestJobs.listByCollection, { collectionId: props.gallery._id }, { server: false });
const { mutate: retry } = useConvexMutation(api.ingestJobs.retry);
const { sending, upload } = useZipUpload(() => props.gallery._id);

const ready = computed(() => props.gallery.imagesCount);
const busy = computed(() => (jobs.value ?? [])
  .filter((job) => job.status === "running" && job.totalImages)
  .reduce((sum, job) => sum + job.totalImages! - job.processedImages, 0));
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
const pickError = ref<string>();
function add(files: FileList | null | undefined) {
  const all = Array.from(files ?? []);
  const zips = all.filter((file) => file.name.toLowerCase().endsWith(".zip"));
  pickError.value = zips.length < all.length ? "Only ZIP files can be added. Put your photos in a ZIP first." : undefined;
  if (zips.length) upload(zips);
  if (picker.value) picker.value.value = "";
}

const JOB_STATE: Record<Doc<"ingestJobs">["status"], { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting", tone: "idle" },
  running: { label: "Finding faces", tone: "busy" },
  completed: { label: "Ready", tone: "ok" },
  failed: { label: "Didn't finish", tone: "bad" },
  canceled: { label: "Canceled", tone: "idle" },
};

function jobNote(job: Doc<"ingestJobs">) {
  if (job.status === "running") return job.totalImages ? `${count.format(job.processedImages)} of ${count.format(job.totalImages)} photos` : "Opening the ZIP";
  if (job.status === "completed") {
    const saved = job.savedImages ?? job.processedImages;
    const skipped = job.processedImages - saved;
    return `${count.format(saved)} photos added${skipped ? `. ${count.format(skipped)} without faces were left out and not charged` : ""}`;
  }
  return job.error;
}
const megabytes = (bytes: number) => `${count.format(Math.ceil(bytes / 1e6))} MB`;
</script>

<template>
  <DashboardCard title="Photos">
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
        <span><b>Add photos</b><small>Drop ZIP files here or choose them. JPEG or PNG photos, up to 2 GB per ZIP. Photos without faces are left out and not charged.</small></span>
      </button>
      <input ref="picker" type="file" accept=".zip,application/zip" multiple hidden @change="add(($event.target as HTMLInputElement).files)">
      <p v-if="pickError" class="error" role="alert">{{ pickError }}</p>
    </div>

    <ul v-if="sending.length || jobs?.length" class="uploads">
      <li v-for="file in sending" :key="file.id">
        <p><b>{{ file.name }}</b><span>{{ megabytes(file.size) }}</span></p>
        <div>
          <template v-if="file.error">
            <DashboardPill tone="bad">Not uploaded</DashboardPill><span class="note-text">{{ file.error }}</span>
          </template>
          <template v-else>
            <DashboardPill tone="busy">Uploading</DashboardPill><span class="note-text">{{ Math.floor(file.progress * 100) }}%</span>
            <span class="meter"><i :style="{ width: `${file.progress * 100}%` }" /></span>
          </template>
        </div>
      </li>
      <li v-for="job in jobs" :key="job._id">
        <p><b>{{ job.filename }}</b><span>{{ shortDate.format(job.createdAt) }}</span></p>
        <div>
          <DashboardPill :tone="JOB_STATE[job.status].tone">{{ JOB_STATE[job.status].label }}</DashboardPill>
          <span class="note-text">{{ jobNote(job) }}</span>
          <span v-if="job.status === 'running' && job.totalImages" class="meter"><i :style="{ width: `${job.processedImages / job.totalImages * 100}%` }" /></span>
          <Button v-if="job.status === 'failed' || job.status === 'canceled'" variant="line" size="sm" @click="retry({ id: job._id })"><RotateCcw />Try again</Button>
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
.drop { display: flex; align-items: center; justify-content: center; gap: 14px; width: 100%; padding: 18px; border: 2px dashed #c2c2bd; border-radius: 10px; text-align: left; cursor: pointer; transition: border-color .2s, background-color .2s; }
.drop:hover, .drop.over { background: var(--accent); border-color: var(--foreground); }
.drop svg { flex: none; width: 28px; height: 28px; }
.drop b { display: block; font-size: 1.1rem; font-weight: 800; font-stretch: 110%; }
.drop small { display: block; max-width: 60ch; color: var(--muted-foreground); font-size: .88rem; }
.note { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; padding: 18px 20px; background: var(--accent); border: 2px solid var(--brand); border-radius: 10px; }
.error { margin-top: 10px; color: var(--destructive); font-size: .9rem; }

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

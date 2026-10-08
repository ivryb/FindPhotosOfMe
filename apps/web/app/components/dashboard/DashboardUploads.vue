<script setup lang="ts">
import type { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { DAY } from "@FindPhotosOfMe/backend/convex/pricing";
import type { FunctionReturnType } from "convex/server";
import { useIntervalFn, useNow } from "@vueuse/core";
import { ChevronRight, Upload } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import type { Sending } from "@/composables/usePhotoUpload";

type UploadItem = FunctionReturnType<typeof api.uploads.list>[number];
/** Where an upload this tab isn't sending stands. */
type Kind = "stopped" | "arriving" | "abandoned" | "finding" | "done";
type Line = { key: string; title: string; numbers: string; progress: number; note?: string; warning?: string };
// `alert` is for what just went wrong here; uploads stopped earlier are listed without being announced on every visit.
type Problem = { key: string; name: string; message: string; action: "again" | "dismiss"; alert: boolean };

// What's happening to a gallery's uploads, summed up in a few lines with anything that needs the owner,
// then what each day's uploads added. `again` asks for the files to continue a stopped upload.
const props = defineProps<{ uploads: UploadItem[]; sending: Sending[] }>();
const emit = defineEmits<{ again: []; dismiss: [key: string] }>();

// Unfinished uploads no tab here is sending move to History once they've clearly been left: a guest's after an hour,
// since only their phone can finish it, and the owner's after a day. Adding the same files again still resumes them.
const LEFT_AFTER = { guest: 60 * 60 * 1000, owner: DAY };
// A minute is precise enough for both, and keeps the lists from recomputing every frame.
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 60_000) });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function kindOf(item: UploadItem): Kind {
  if (item.sent < item.photos) {
    if (now.value.getTime() - item._creationTime >= LEFT_AFTER[item.contributorKey ? "guest" : "owner"]) return "abandoned";
    return item.contributorKey ? "arriving" : "stopped";
  }
  return item.processed < item.photos ? "finding" : "done";
}

// Uploads this tab is sending are described by `sending`, which is ahead of Convex.
const others = computed(() => {
  const here = new Set(props.sending.map((entry) => entry.uploadId));
  return props.uploads.filter((item) => !here.has(item._id)).map((item) => ({ item, kind: kindOf(item) }));
});
const ofKind = (kind: Kind) => others.value.filter((entry) => entry.kind === kind).map(({ item }) => item);

const lines = computed(() => {
  const result: Line[] = [];
  const [first, ...rest] = props.sending.filter((entry) => !entry.error);
  if (first) {
    const active = [first, ...rest];
    const [sent, total] = [sum(active, (entry) => entry.sent), sum(active, (entry) => entry.photos)];
    const tooLarge = sum(active, (entry) => entry.tooLarge);
    result.push({
      key: "sending",
      title: rest.length ? "Uploading" : `Uploading ${short(first.name)}`,
      numbers: total ? `${count.format(sent)} of ${photos(total)} sent` : "Reading the files",
      progress: total ? sent / total : 0,
      note: rest.length ? `Keep this tab open until it finishes: ${names(active)}.` : "Keep this tab open until it finishes.",
      warning: tooLarge ? `${photos(tooLarge)} over 50 MB were skipped.` : undefined,
    });
  }
  const arriving = ofKind("arriving");
  if (arriving.length) {
    const [received, total] = [sum(arriving, (item) => item.sent), sum(arriving, (item) => item.photos)];
    result.push({ key: "arriving", title: `${plural(arriving.length, "guest upload")} arriving`, numbers: `${count.format(received)} of ${photos(total)} received`, progress: received / total });
  }
  const finding = ofKind("finding");
  if (finding.length) {
    const [checked, total] = [sum(finding, (item) => item.processed + item.progress), sum(finding, (item) => item.photos)];
    result.push({ key: "finding", title: "Finding faces", numbers: `${count.format(checked)} of ${photos(total)}`, progress: checked / total, note: names(finding) });
  }
  return result;
});

const problems = computed(() => [
  ...props.sending.flatMap((entry): Problem[] => (entry.error ? [{ key: entry.key, name: entry.name, message: entry.error, action: entry.uploadId ? "again" : "dismiss", alert: true }] : [])),
  ...ofKind("stopped").map((item): Problem => ({ key: item._id, name: item.name, message: `Stopped at ${count.format(item.sent)} of ${photos(item.photos)}.`, action: "again", alert: false })),
]);

// Finished uploads by day, newest first as Convex lists them. Guests' uploads are counted together.
const days = computed(() => {
  const groups: { label: string; items: UploadItem[] }[] = [];
  for (const { item, kind } of others.value) {
    if (kind !== "done" && kind !== "abandoned") continue;
    const label = dayLabel(item._creationTime);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups.map(({ label, items }) => {
    const guests = items.filter((item) => item.contributorKey);
    const [leftOut, failed] = [sum(items, leftOutOf), sum(items, (item) => item.failed)];
    return {
      label,
      summary: [
        plural(items.length, "upload"), `${photos(sum(items, (item) => item.saved))} added`,
        leftOut && `${count.format(leftOut)} left out`, failed && `${count.format(failed)} couldn’t be processed`,
      ].filter(Boolean).join(" · "),
      rows: items.filter((item) => !item.contributorKey).map((item) => ({ key: item._id, name: item.name, result: result(item), time: time.format(item._creationTime) })),
      guests: guests.length ? `${plural(guests.length, "upload")} · ${photos(sum(guests, (item) => item.saved))} added` : "",
    };
  });
});

// Left out: no faces, or turned away in a guest gallery, and not charged. Failed: couldn't be processed after retries, and refunded.
const leftOutOf = (item: UploadItem) => item.processed - item.saved - item.failed;

function result(item: UploadItem) {
  if (item.sent < item.photos) return `Stopped at ${count.format(item.sent)} of ${photos(item.photos)}`;
  if (item.photos === 1) return item.saved ? "Added" : item.failed ? "Couldn’t be processed" : "Left out";
  return [
    `${count.format(item.saved)} added`, leftOutOf(item) && `${count.format(leftOutOf(item))} left out`, item.failed && `${count.format(item.failed)} couldn’t be processed`,
  ].filter(Boolean).join(" · ");
}

function dayLabel(created: number) {
  const day = new Date(created).toDateString();
  const today = now.value.getTime();
  if (day === new Date(today).toDateString()) return "Today";
  if (day === new Date(today - DAY).toDateString()) return "Yesterday";
  return shortDate.format(created);
}

const sum = <T>(items: T[], read: (item: T) => number) => items.reduce((total, item) => total + read(item), 0);
const plural = (n: number, word: string) => `${count.format(n)} ${n === 1 ? word : `${word}s`}`;
const photos = (n: number) => plural(n, "photo");
// Long names keep their end, where the day or part usually is.
const short = (name: string, max = 44) => (name.length <= max ? name : `${name.slice(0, max - 23)}…${name.slice(-22)}`);
const names = (items: { name: string }[]) => items.slice(0, 3).map((item) => short(item.name, 32)).join(", ") + (items.length > 3 ? `, and ${count.format(items.length - 3)} more` : "");
</script>

<template>
  <div v-if="lines.length || problems.length" class="now">
    <div v-for="line in lines" :key="line.key" class="line">
      <b>{{ line.title }}</b>
      <span>{{ line.numbers }}</span>
      <span class="meter"><i :style="{ width: `${line.progress * 100}%` }" /></span>
      <small v-if="line.note">{{ line.note }}</small>
      <small v-if="line.warning" class="warning">{{ line.warning }}</small>
    </div>
    <div v-for="problem in problems" :key="problem.key" class="problem" :role="problem.alert ? 'alert' : undefined">
      <p><b :title="problem.name">{{ short(problem.name, 40) }}</b> · {{ problem.message }}</p>
      <Button v-if="problem.action === 'again'" variant="outline" size="sm" @click="emit('again')"><Upload />Add it again</Button>
      <button v-else type="button" class="dismiss" @click="emit('dismiss', problem.key)">Dismiss</button>
    </div>
  </div>

  <section v-if="days.length" class="history" aria-labelledby="upload-history">
    <h3 id="upload-history">History</h3>
    <details v-for="day in days" :key="day.label">
      <summary><ChevronRight aria-hidden="true" /><b>{{ day.label }}</b><span>{{ day.summary }}</span></summary>
      <ul>
        <li v-for="row in day.rows" :key="row.key"><span class="name" :title="row.name">{{ short(row.name) }}</span><span>{{ row.result }}</span><time>{{ row.time }}</time></li>
        <li v-if="day.guests"><b>Guests</b><span>{{ day.guests }}</span><time /></li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.now { display: grid; gap: 18px; margin-top: 20px; padding: 20px; background: var(--muted); border-radius: 12px; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 6px 16px; }
.line b { overflow: hidden; font-weight: 800; font-stretch: 108%; text-overflow: ellipsis; white-space: nowrap; }
.line > span { color: var(--muted-foreground); font-size: .92rem; font-variant-numeric: tabular-nums; }
.meter { grid-column: 1 / -1; height: 8px; overflow: hidden; background: rgb(21 21 21 / .08); border-radius: 4px; }
.meter i { display: block; height: 100%; background: var(--foreground); border-radius: inherit; transition: width .3s; }
.line small { grid-column: 1 / -1; overflow: hidden; color: var(--muted-foreground); font-size: .86rem; text-overflow: ellipsis; white-space: nowrap; }
.line small.warning { color: #a8261a; white-space: normal; }
.problem { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 12px 14px; background: #fde6e3; border-radius: 8px; color: #a8261a; font-size: .92rem; }
.problem b { color: var(--foreground); overflow-wrap: anywhere; }
.dismiss { font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; cursor: pointer; }

.history { margin-top: 28px; }
.history h3 { margin-bottom: 6px; font-size: 1rem; font-weight: 750; font-stretch: 100%; letter-spacing: 0; }
summary { display: grid; grid-template-columns: 16px auto minmax(0, 1fr); align-items: center; gap: 12px; margin-inline: -12px; padding: 11px 12px; border-radius: 8px; list-style: none; cursor: pointer; }
summary::-webkit-details-marker { display: none; }
summary:hover { background: var(--muted); }
summary svg { width: 16px; height: 16px; transition: rotate .2s; }
details[open] summary svg { rotate: 90deg; }
summary span { color: var(--muted-foreground); font-size: .92rem; }
li { display: grid; grid-template-columns: minmax(0, 1fr) auto 72px; gap: 14px; padding: 5px 0 5px 28px; font-size: .92rem; }
li > span:nth-child(2), time { color: var(--muted-foreground); font-variant-numeric: tabular-nums; text-align: right; }
li b { font-weight: 650; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 600px) {
  summary { grid-template-columns: 16px minmax(0, 1fr); }
  summary span { grid-column: 2; }
  li { grid-template-columns: minmax(0, 1fr) auto; padding-left: 28px; }
  time { display: none; }
}
@media (prefers-reduced-motion: reduce) { summary svg, .meter i { transition: none; } }
</style>

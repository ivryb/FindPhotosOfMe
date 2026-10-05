<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { DAY, dailyStorageCost, formatMoney } from "@FindPhotosOfMe/backend/convex/pricing";
import { useConvexMutation } from "convex-vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Gallery } from "@/utils/galleries";

// The date a gallery goes offline, chosen by its owner, and what keeping it online costs. Storage past the paid time
// comes out of the balance a day at a time, so the date can move either way and nothing is charged up front.
const props = defineProps<{ gallery: Gallery }>();

// The owner picks a day in their own time zone; the gallery goes offline at the end of it.
const toDay = (time: number) => new Date(time - new Date(time).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const endOf = (day: string) => new Date(`${day}T23:59:59`).getTime();

const expiresAt = computed(() => props.gallery.expiresAt ?? Date.now());
const day = ref(toDay(expiresAt.value));
watch(expiresAt, (time) => (day.value = toDay(time)));
const tomorrow = toDay(Date.now() + DAY);

const offline = computed(() => expiresAt.value <= Date.now());
const changed = computed(() => day.value !== toDay(expiresAt.value));
const included = computed(() => {
  const until = props.gallery.storagePaidUntil;
  return until && until > Date.now() ? shortDate.format(until) : undefined;
});
const daily = computed(() => dailyStorageCost(props.gallery));
// What the chosen day adds past the paid time, at the gallery's size today
const estimate = computed(() => {
  if (!day.value) return 0;
  const paidUntil = Math.max(props.gallery.storagePaidUntil ?? expiresAt.value, Date.now());
  return Math.max(0, Math.ceil((endOf(day.value) - paidUntil) / DAY)) * daily.value;
});

const { mutate: keepOnlineUntil } = useConvexMutation(api.balances.keepOnlineUntil);
const saving = ref(false);
const error = ref<string>();
async function save() {
  saving.value = true;
  error.value = undefined;
  try {
    await keepOnlineUntil({ id: props.gallery._id, until: endOf(day.value) });
  } catch (cause) {
    error.value = readableError(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="online" @submit.prevent="save">
    <div class="row">
      <label :for="`until-${gallery._id}`">
        {{ offline ? `Offline since ${shortDate.format(expiresAt)}. Bring it back online until` : "Online until" }}
      </label>
      <Input :id="`until-${gallery._id}`" v-model="day" type="date" :min="tomorrow" required class="date" />
      <Button v-if="changed || offline" type="submit" size="sm" :disabled="saving || !day">{{ saving ? "Saving…" : "Save" }}</Button>
    </div>
    <p class="note">
      <template v-if="!daily">Storage is free for a gallery this small.</template>
      <template v-else>
        {{ included ? `Storage is included until ${included}. After that, it costs` : "Keeping it online costs" }}
        about {{ formatMoney(daily * 30) }} for every 30 days at its current size, taken from your balance each day.
      </template>
      <b v-if="changed && estimate"> Until {{ shortDate.format(endOf(day)) }}, that’s about {{ formatMoney(estimate) }}.</b>
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>

<style scoped>
.online { margin-top: 14px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
label { color: var(--muted-foreground); }
.date { width: auto; background: var(--background); }
.note { max-width: 62ch; margin-top: 8px; color: var(--muted-foreground); font-size: .9rem; }
.note b { color: var(--foreground); font-weight: 600; }
.error { margin-top: 6px; color: var(--destructive); font-size: .9rem; }
</style>

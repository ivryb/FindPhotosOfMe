<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { MAXIMUM_TOP_UP, MILLS_PER_DOLLAR, MINIMUM_TOP_UP, coveredBy, formatMoney } from "@FindPhotosOfMe/backend/convex/pricing";
import { useConvexClient } from "convex-vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Adds money to the balance every gallery shares, through a Lemon Squeezy checkout.
const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ credit: number }>();

const payments = useRuntimeConfig().public.payments;

const PRESETS = [10, 25, 50, 100];
const dollars = ref(25);
const amount = computed(() => Math.round(dollars.value * MILLS_PER_DOLLAR));
const valid = computed(() => amount.value >= MINIMUM_TOP_UP && amount.value <= MAXIMUM_TOP_UP);
const after = computed(() => props.credit + amount.value);
const convex = useConvexClient();
const paying = ref(false);
const error = ref<string>();

async function pay() {
  paying.value = true;
  error.value = undefined;
  try {
    window.location.assign(await convex.action(api.payments.createTopUp, { amount: amount.value }));
  } catch (cause) {
    error.value = readableError(cause, "Checkout didn't open. Please try again.");
    paying.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[540px]">
      <div v-if="!payments" class="grid gap-5">
        <DialogHeader>
          <DialogTitle class="text-xl sm:text-3xl">Top-ups open soon</DialogTitle>
          <DialogDescription>We’re still setting up payments. Until then, you can use your free credit.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button size="lg" @click="open = false">Got it</Button>
        </DialogFooter>
      </div>
      <form v-else class="grid gap-5" @submit.prevent="pay">
        <DialogHeader>
          <DialogTitle class="text-xl sm:text-3xl">Top up your balance</DialogTitle>
          <DialogDescription>All your galleries share one balance. You pay once, and nothing renews.</DialogDescription>
        </DialogHeader>
        <fieldset class="grid gap-3">
          <legend class="mb-3 text-sm font-semibold">Amount</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in PRESETS"
              :key="preset"
              type="button"
              :aria-pressed="dollars === preset"
              :class="['rounded-full border-2 px-5 py-2 font-bold', dollars === preset ? 'border-foreground bg-foreground text-background' : 'border-border']"
              @click="dollars = preset"
            >
              {{ formatMoney(preset * MILLS_PER_DOLLAR) }}
            </button>
          </div>
          <div class="grid gap-2">
            <Label for="top-up-amount">Or another amount, in dollars</Label>
            <Input id="top-up-amount" v-model.number="dollars" type="number" :min="MINIMUM_TOP_UP / MILLS_PER_DOLLAR" :max="MAXIMUM_TOP_UP / MILLS_PER_DOLLAR" step="1" inputmode="decimal" />
          </div>
        </fieldset>
        <div class="slip">
          <p class="flex items-baseline justify-between gap-4"><span>Your balance after</span><b class="total">{{ formatMoney(after) }}</b></p>
          <p class="mt-2 text-sm">About {{ count.format(coveredBy(after, "photo")) }} photos or {{ count.format(coveredBy(after, "search")) }} searches. Photos are $5 per 1,000, searches $1.50 per 100.</p>
        </div>
        <p v-if="!valid" class="text-sm text-destructive">Top up between {{ formatMoney(MINIMUM_TOP_UP) }} and {{ formatMoney(MAXIMUM_TOP_UP) }}.</p>
        <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="line" size="lg" @click="open = false">Cancel</Button>
          <Button type="submit" size="lg" :disabled="!valid || paying">{{ paying ? "Opening checkout…" : `Pay ${formatMoney(amount)}` }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.slip { padding: 18px 20px; background: var(--brand); border-radius: 12px; }
.slip p:last-child { color: #4f4826; }
.total { font-size: 2.4rem; font-weight: 850; font-stretch: 118%; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; }
</style>

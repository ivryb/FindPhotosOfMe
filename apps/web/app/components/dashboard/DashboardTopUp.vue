<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { formatMoney } from "@FindPhotosOfMe/backend/convex/pricing";
import { useConvexClient } from "convex-vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Adds money to the balance every gallery shares: the calculator sets the amount, and a Lemon Squeezy checkout takes it.
const open = defineModel<boolean>("open", { required: true });
defineProps<{ credit: number }>();

const payments = useRuntimeConfig().public.payments;
const convex = useConvexClient();
const paying = ref(false);
const error = ref<string>();

async function pay(amount: number) {
  paying.value = true;
  error.value = undefined;
  try {
    window.location.assign(await convex.action(api.payments.createTopUp, { amount }));
  } catch (cause) {
    error.value = readableError(cause, "Checkout didn't open. Please try again.");
    paying.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="!payments" class="sm:max-w-[540px]">
      <DialogHeader>
        <DialogTitle class="text-xl sm:text-3xl">Top-ups open soon</DialogTitle>
        <DialogDescription>We’re still setting up payments. Until then, you can use your free credit.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button size="lg" @click="open = false">Got it</Button>
      </DialogFooter>
    </DialogContent>
    <!-- Opening without focusing the photo count, which would select its digits -->
    <DialogContent v-else class="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-[780px]" @open-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle class="text-xl sm:text-3xl">Top up your balance</DialogTitle>
        <DialogDescription>Pick what you expect to use. All your galleries share one balance, and nothing renews.</DialogDescription>
      </DialogHeader>
      <PricingCalculator v-slot="{ total }" compact>
        <p class="after"><span>Your balance after</span><b>{{ formatMoney(credit + total) }}</b></p>
        <p v-if="error" class="mb-3 text-sm text-destructive" role="alert">{{ error }}</p>
        <Button size="lg" class="w-full" :disabled="paying" @click="pay(total)">{{ paying ? "Opening checkout…" : `Pay ${formatMoney(total)}` }}</Button>
      </PricingCalculator>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.after { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; padding-top: 10px; border-top: 2px solid var(--foreground); font-weight: 650; font-variant-numeric: tabular-nums; }
</style>

<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { extensionCost, formatMoney } from "@FindPhotosOfMe/backend/convex/pricing";
import { useConvexMutation } from "convex-vue";
import { Check, Copy, ExternalLink } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import type { Gallery } from "@/utils/galleries";

// The top of a gallery's dashboard page: its status, name, link to share, how long it stays online, and its QR code.
const props = defineProps<{ gallery: Gallery }>();

const address = useGalleryAddress();
const link = computed(() => address.link(props.gallery.subdomain));
const status = computed(() => galleryStatus(props.gallery));
const offline = computed(() => Boolean(props.gallery.expiresAt && props.gallery.expiresAt <= Date.now()));
const until = computed(() => (props.gallery.expiresAt ? shortDate.format(props.gallery.expiresAt) : undefined));

const copied = ref(false);
async function copy() {
  await navigator.clipboard.writeText(link.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

const { mutate: extend } = useConvexMutation(api.balances.extendStorage);
const extending = ref(false);
const error = ref<string>();
async function keepOnline() {
  extending.value = true;
  error.value = undefined;
  try {
    await extend({ id: props.gallery._id });
  } catch (cause) {
    error.value = readableError(cause);
  } finally {
    extending.value = false;
  }
}
</script>

<template>
  <div class="head">
    <div>
      <DashboardPill :tone="status.tone">{{ status.label }}</DashboardPill>
      <h1>{{ gallery.title }}</h1>
      <div class="share">
        <a class="url" :href="link" target="_blank">{{ link.replace(/^https?:\/\//, "") }}</a>
        <Button variant="line" size="sm" @click="copy"><component :is="copied ? Check : Copy" />{{ copied ? "Copied" : "Copy link" }}</Button>
        <Button variant="line" size="sm" as="a" :href="link" target="_blank"><ExternalLink />Open page</Button>
      </div>
      <p class="meta">
        {{ gallery.imagesCount ? `${count.format(gallery.imagesCount)} photos.` : "No photos yet." }}
        <template v-if="gallery.paymentStatus === 'refunded'">This gallery was refunded.</template>
        <template v-else-if="offline">Offline since {{ until }}.</template>
        <template v-else-if="until">Online until {{ until }}.</template>
        <template v-if="gallery.trial && !offline"> Your first top-up keeps it online for 30 days.</template>
      </p>
      <div v-if="!gallery.trial && gallery.paymentStatus !== 'refunded'" class="extend">
        <Button variant="line" size="sm" :disabled="extending" @click="keepOnline">
          {{ extending ? "Adding 30 days…" : `${offline ? "Bring back online" : "Keep online"} for 30 more days, ${formatMoney(extensionCost(gallery))}` }}
        </Button>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
    </div>
    <DashboardQrCard class="qr" :link="link" :name="gallery.title" />
  </div>
</template>

<style scoped>
.head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 24px 32px; }
h1 { margin-top: 12px; font-size: clamp(2.2rem, 4.6vw, 3.6rem); overflow-wrap: anywhere; }
.share { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; margin-top: 16px; }
.url { margin-right: 6px; font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; overflow-wrap: anywhere; }
.meta { margin-top: 14px; color: var(--muted-foreground); }
.extend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 12px; }
.error { color: var(--destructive); font-size: .9rem; }
@media (max-width: 760px) { .head { grid-template-columns: 1fr; } .qr { display: none; } }
</style>

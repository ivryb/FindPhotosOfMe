<script setup lang="ts">
import { Check, Copy, ExternalLink } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import type { Gallery } from "@/utils/galleries";

// The top of a gallery's dashboard page: its status, name, link to share, how long it stays online, and its QR code.
const props = defineProps<{ gallery: Gallery }>();

const address = useGalleryAddress();
const link = computed(() => address.link(props.gallery));
const published = computed(() => props.gallery.published !== false && Boolean(link.value));
const status = computed(() => galleryStatus(props.gallery));
const offline = computed(() => Boolean(props.gallery.expiresAt && props.gallery.expiresAt <= Date.now()));
const until = computed(() => (props.gallery.expiresAt ? shortDate.format(props.gallery.expiresAt) : undefined));
// Trial galleries get their time from the first top-up, and galleries from before expiry dates stay online.
const scheduled = computed(() => !props.gallery.trial && props.gallery.paymentStatus !== "refunded" && Boolean(props.gallery.expiresAt));

const copied = ref(false);
async function copy() {
  await navigator.clipboard.writeText(link.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="head">
    <div>
      <DashboardPill :tone="status.tone">{{ status.label }}</DashboardPill>
      <h1>{{ gallery.title }}</h1>
      <p v-if="!published" class="meta">Private · Only you can see and search this gallery.</p>
      <div v-if="published" class="share">
        <a class="url" :href="link" target="_blank">{{ link.replace(/^https?:\/\//, "") }}</a>
        <Button variant="outline" size="sm" @click="copy"><component :is="copied ? Check : Copy" />{{ copied ? "Copied" : "Copy link" }}</Button>
        <Button variant="outline" size="sm" as="a" :href="link" target="_blank"><ExternalLink />Open page</Button>
      </div>
      <p class="meta">
        {{ gallery.imagesCount ? `${count.format(gallery.imagesCount)} photos.` : "No photos yet." }}
        <template v-if="gallery.paymentStatus === 'refunded'">This gallery was refunded.</template>
        <template v-else-if="gallery.trial && offline">Offline since {{ until }}.</template>
        <template v-else-if="gallery.trial">Online until {{ until }}. Your first top-up keeps it online for 30 days.</template>
      </p>
      <DashboardOnlineUntil v-if="scheduled" :gallery="gallery" />
    </div>
    <DashboardQrCard v-if="published" class="qr" :link="link" :name="gallery.title" />
  </div>
</template>

<style scoped>
.head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 24px 32px; }
h1 { margin-top: 12px; font-size: clamp(2.2rem, 4.6vw, 3.6rem); overflow-wrap: anywhere; }
.share { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; margin-top: 16px; }
.url { margin-right: 6px; font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; overflow-wrap: anywhere; }
.meta { margin-top: 14px; color: var(--muted-foreground); }
@media (max-width: 760px) { .head { grid-template-columns: 1fr; } .qr { display: none; } }
</style>

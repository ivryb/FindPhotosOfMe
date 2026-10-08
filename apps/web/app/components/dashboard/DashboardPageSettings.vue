<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Gallery } from "@/utils/galleries";

// The Gallery page tab: sharing, what guests can do, and the page's text beside a preview of the page.
// Each card saves on its own: switches as soon as they're flipped, text with Save.
const props = defineProps<{ gallery: Gallery }>();

const guests = reactive({ browse: props.gallery.showAllPhotos ?? true, upload: props.gallery.crowdsource ?? false });
const guestAccess = reactive(useGalleryUpdate(() => props.gallery));
async function setGuests(change: Partial<typeof guests>) {
  Object.assign(guests, change);
  if (await guestAccess.save({ showAllPhotos: guests.browse, crowdsource: guests.upload })) return;
  // A switch that didn't save goes back, so it doesn't show a change that never happened.
  Object.assign(guests, { browse: props.gallery.showAllPhotos ?? true, upload: props.gallery.crowdsource ?? false });
}

const text = reactive({ title: props.gallery.title, description: props.gallery.description });
// Saving trims the text, so trimmed text that matches what's saved has nothing left to save.
const textChanged = computed(() => text.title.trim() !== props.gallery.title || text.description.trim() !== props.gallery.description);
const pageText = reactive(useGalleryUpdate(() => props.gallery));
</script>

<template>
  <div class="cards">
    <DashboardSharing :gallery="gallery" />

    <DashboardCard title="Guests can" :saved="guestAccess.saved">
      <div class="grid gap-5">
        <div class="flex items-start gap-3">
          <Switch id="page-browse" :model-value="guests.browse" :disabled="guestAccess.saving" class="mt-0.5" @update:model-value="setGuests({ browse: $event })" />
          <div class="grid gap-1">
            <Label for="page-browse">Browse every photo</Label>
            <p class="text-sm text-muted-foreground">When this is off, people see a few photos and find the rest with a selfie{{ guests.upload ? ", so guest photos without faces are visible only to you" : "" }}.</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <Switch id="page-upload" :model-value="guests.upload" :disabled="guestAccess.saving" class="mt-0.5" @update:model-value="setGuests({ upload: $event })" />
          <div class="grid gap-1">
            <Label for="page-upload">Upload their own photos</Label>
            <p class="text-sm text-muted-foreground">Anyone with access can add photos from the gallery page or Telegram, without signing in. Photos without faces are kept too. Uploads use your balance.</p>
          </div>
        </div>
        <p v-if="guestAccess.error" class="text-sm text-destructive" role="alert">{{ guestAccess.error }}</p>
      </div>
    </DashboardCard>

    <DashboardCard title="Page text" :saved="pageText.saved">
      <div class="text">
        <form class="grid content-start gap-5" @submit.prevent="pageText.save(text)">
          <div class="grid gap-2">
            <Label for="page-name">Name</Label>
            <Input id="page-name" v-model="text.title" required />
          </div>
          <div class="grid gap-2">
            <Label for="page-description">Description</Label>
            <Textarea id="page-description" v-model="text.description" placeholder="Where and when it was, and who took the photos" rows="4" />
          </div>
          <div v-if="textChanged || pageText.error" class="flex flex-wrap items-center gap-3">
            <Button v-if="textChanged" type="submit" size="sm" :disabled="pageText.saving">{{ pageText.saving ? "Saving…" : "Save" }}</Button>
            <p v-if="pageText.error" class="text-sm text-destructive" role="alert">{{ pageText.error }}</p>
          </div>
        </form>
        <DashboardPagePreview :gallery="gallery" :title="text.title" :description="text.description" :browse="guests.browse" :uploads="guests.upload" />
      </div>
    </DashboardCard>
  </div>
</template>

<style scoped>
.cards { display: grid; gap: 16px; }
.cards :deep(h2) { font-size: 1.3rem; }
.text { display: grid; grid-template-columns: minmax(0, 1fr) 210px; align-items: start; gap: 24px clamp(24px, 4vw, 40px); }
@media (max-width: 760px) { .text { grid-template-columns: minmax(0, 1fr); } .text > figure { width: min(240px, 100%); } }
</style>

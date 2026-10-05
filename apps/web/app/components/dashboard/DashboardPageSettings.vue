<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useElementVisibility, whenever } from "@vueuse/core";
import { useConvexMutation } from "convex-vue";
import { Camera } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Gallery } from "@/utils/galleries";

// Publication is separate from editing the page; private galleries can be prepared before sharing.
const props = defineProps<{ gallery: Gallery }>();

const form = reactive({
  title: props.gallery.title,
  subdomain: props.gallery.subdomain ?? "",
  description: props.gallery.description,
  showAllPhotos: props.gallery.showAllPhotos ?? true,
});
const { host } = useGalleryAddress();

// The tab stays mounted while hidden, so the preview's photos load only once it's on screen.
const { photos, load } = useGalleryPhotos(() => props.gallery._id, { owner: true });
const preview = useTemplateRef("preview");
whenever(useElementVisibility(preview), load, { once: true });
const previews = computed(() => photos.value.slice(0, 8));

const { mutate: update } = useConvexMutation(api.collections.update);
const saving = ref(false);
const saved = ref(false);
const error = ref<string>();
async function save() {
  saving.value = true;
  saved.value = false;
  error.value = undefined;
  try {
    await update({ id: props.gallery._id, ...form, welcomeMessage: props.gallery.welcomeMessage });
    saved.value = true;
    await navigateTo(`/admin/galleries/${props.gallery._id}?tab=page`, { replace: true });
  } catch (cause) {
    error.value = readableError(cause);
  } finally {
    saving.value = false;
  }
}

const published = computed(() => props.gallery.published !== false);
const { mutate: setPublished } = useConvexMutation(api.collections.setPublished);
const publishing = ref(false);
const publishError = ref<string>();
async function publish(value: boolean) {
  publishing.value = true;
  publishError.value = undefined;
  try {
    await setPublished({ id: props.gallery._id, published: value });
  } catch (cause) {
    publishError.value = readableError(cause);
  } finally {
    publishing.value = false;
  }
}
</script>

<template>
  <DashboardCard title="Gallery page">
    <template #aside><p>What people see when they open your link.</p></template>
    <div class="publication">
      <div class="flex items-start gap-3">
        <Switch id="page-publish" :model-value="published" :disabled="publishing || saving" class="mt-0.5" @update:model-value="publish" />
        <div class="grid gap-1">
          <Label for="page-publish">Publish this gallery</Label>
          <p class="text-sm text-muted-foreground">{{ published ? "Anyone with the link can see this gallery and search for their photos." : "Only you can see and search this gallery. Save a page address below when you’re ready to share it." }}</p>
          <p v-if="publishError" class="text-sm text-destructive" role="alert">{{ publishError }}</p>
        </div>
      </div>
    </div>
    <div class="layout">
      <form class="grid gap-5" @submit.prevent="save" @input="saved = false">
        <div class="grid gap-2">
          <Label for="page-name">Name</Label>
          <Input id="page-name" v-model="form.title" required />
        </div>
        <div class="grid gap-2">
          <Label for="page-address">Page address</Label>
          <div class="flex">
            <Input id="page-address" v-model="form.subdomain" class="rounded-r-none" :required="published" pattern="[a-z0-9\-]+" maxlength="63" autocomplete="off" />
            <span class="flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">.{{ host }}</span>
          </div>
          <p class="text-sm text-muted-foreground">Choose an address before publishing. Changing it breaks links you’ve already shared.</p>
        </div>
        <div class="grid gap-2">
          <Label for="page-description">Description</Label>
          <Textarea id="page-description" v-model="form.description" placeholder="Where and when it was, and who took the photos" rows="3" />
        </div>
        <div class="flex items-start gap-3">
          <Switch id="page-browse" v-model="form.showAllPhotos" class="mt-0.5" @update:model-value="saved = false" />
          <div class="grid gap-1">
            <Label for="page-browse">Let people browse every photo</Label>
            <p class="text-sm text-muted-foreground">When this is off, people see a few photos and find the rest with a selfie.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" :disabled="saving || publishing">{{ saving ? "Saving…" : "Save changes" }}</Button>
          <p v-if="saved" class="text-sm text-muted-foreground" role="status">Saved</p>
          <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        </div>
      </form>

      <div>
        <div ref="preview" class="browser" aria-label="Preview of your gallery page">
          <div class="browser-bar" aria-hidden="true"><i /><i /><i /><span>{{ form.subdomain ? `${form.subdomain}.${host}` : "Private preview" }}</span></div>
          <div class="mini">
            <p class="mini-title">{{ form.title }}</p>
            <p v-if="form.description" class="mini-desc">{{ form.description }}</p>
            <div class="mini-grid">
              <img v-for="photo in previews" :key="photo.key" :src="photo.thumb" alt="">
              <span v-for="n in Math.max(0, 8 - previews.length)" :key="`blank-${n}`" />
            </div>
            <span class="mini-pill"><Camera />Find photos with you</span>
          </div>
        </div>
        <p class="preview-note">The preview changes as you type.</p>
      </div>
    </div>

  </DashboardCard>

</template>

<style scoped>
.publication { margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: start; gap: 28px clamp(24px, 4vw, 48px); }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
.browser { overflow: hidden; background: var(--foreground); border-radius: 10px; box-shadow: var(--lift); }
.browser-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #e6e6e2; color: var(--muted-foreground); font-size: .8rem; }
.browser-bar i { width: 10px; height: 10px; background: #c9c9c4; border-radius: 50%; }
.browser-bar span { flex: 1; max-width: 280px; margin-left: 10px; padding: 3px 12px; overflow: hidden; background: #fff; border-radius: 6px; text-overflow: ellipsis; white-space: nowrap; }
.mini { position: relative; padding: 18px 18px 70px; color: var(--background); }
.mini-title { font-size: 1.6rem; font-weight: 800; font-stretch: 116%; letter-spacing: -.03em; line-height: 1; overflow-wrap: anywhere; }
.mini-desc { margin-top: 8px; color: #b3b3ad; font-size: .82rem; line-height: 1.4; white-space: pre-line; }
.mini-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin-top: 14px; }
.mini-grid > * { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.mini-grid span { background: #2a2a28; }
.mini-pill { position: absolute; bottom: 16px; left: 50%; display: flex; align-items: center; gap: 8px; padding: 9px 16px; background: var(--brand); color: var(--foreground); border-radius: 999px; font-size: .82rem; font-weight: 800; white-space: nowrap; translate: -50% 0; }
.mini-pill svg { width: 16px; height: 16px; }
.preview-note { margin-top: 10px; color: var(--muted-foreground); font-size: .88rem; }
@media (max-width: 900px) { .mini-title { font-size: 1.25rem; } }
</style>

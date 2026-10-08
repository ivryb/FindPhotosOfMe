<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useClipboard } from "@vueuse/core";
import { useConvexMutation } from "convex-vue";
import { Check, Copy } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Gallery } from "@/utils/galleries";

// Who can open a gallery, and by which link. Publishing applies at once; a new link waits for Save,
// because it can close an address people already have.
const props = defineProps<{ gallery: Gallery }>();
const { host, link } = useGalleryAddress();

const current = computed(() => ({ sharing: props.gallery.sharing ?? "subdomain", subdomain: props.gallery.subdomain ?? "" }));
const draft = reactive({ ...current.value });
const changed = computed(() => draft.sharing !== current.value.sharing || draft.subdomain !== current.value.subdomain);
// The secret link opens the gallery only once it is the saved choice, so it is shown, and copied, only then.
const secretLink = computed(() => (current.value.sharing === "link" ? link(props.gallery) : ""));
const { copy, copied } = useClipboard();

const { save, saving, saved, error } = useGalleryUpdate(() => props.gallery);
async function saveLink() {
  const moved = draft.subdomain !== current.value.subdomain;
  if (!await save({ sharing: draft.sharing, subdomain: draft.subdomain })) return;
  // This page may be open at the old address, which would stop working on reload.
  if (moved) await navigateTo(`/admin/galleries/${props.gallery._id}?tab=page`, { replace: true });
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
  <DashboardCard title="Sharing" :saved="saved">
    <div class="grid gap-6">
      <div class="flex items-start gap-3">
        <Switch id="page-publish" :model-value="published" :disabled="publishing" class="mt-0.5" @update:model-value="publish" />
        <div class="grid gap-1">
          <Label for="page-publish">{{ published ? "Published" : "Private" }}</Label>
          <p class="text-sm text-muted-foreground">{{ published ? "Anyone with the link can see this gallery and search for their photos." : "Only you can see and search this gallery. Publish when you’re ready to share it." }}</p>
          <p v-if="publishError" class="text-sm text-destructive" role="alert">{{ publishError }}</p>
        </div>
      </div>

      <form class="grid gap-4" @submit.prevent="saveLink">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div class="choice" role="radiogroup" aria-label="How people open your gallery">
            <label><input v-model="draft.sharing" type="radio" name="sharing" value="link">Secret link</label>
            <label><input v-model="draft.sharing" type="radio" name="sharing" value="subdomain">Public address</label>
          </div>
          <p class="text-sm text-muted-foreground">{{ draft.sharing === "link" ? "Only people with the link can open it. Hidden from search engines." : "A memorable address anyone can visit." }}</p>
        </div>

        <div v-if="draft.sharing === 'link'" class="secret">
          <template v-if="secretLink">
            <a :href="secretLink" target="_blank">{{ secretLink.replace(/^https?:\/\//, "") }}</a>
            <Button type="button" variant="outline" size="sm" @click="copy(secretLink)"><component :is="copied ? Check : Copy" />{{ copied ? "Copied" : "Copy link" }}</Button>
          </template>
          <p v-else-if="current.sharing === 'link'" class="text-sm text-muted-foreground">Save to create the secret link.</p>
          <p v-else class="text-sm text-muted-foreground">Save to switch to a secret link. This closes the public address, so share the new link instead.</p>
        </div>
        <div v-else class="grid gap-2">
          <Label for="page-address">Page address</Label>
          <div class="flex">
            <Input id="page-address" v-model="draft.subdomain" class="rounded-r-none" :required="published" pattern="[a-z0-9\-]+" maxlength="63" autocomplete="off" />
            <span class="flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">.{{ host }}</span>
          </div>
          <p class="text-sm text-muted-foreground">Changing it breaks links you’ve already shared.</p>
        </div>

        <div v-if="changed || error" class="flex flex-wrap items-center gap-3">
          <Button v-if="changed" type="submit" size="sm" :disabled="saving">{{ saving ? "Saving…" : "Save" }}</Button>
          <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        </div>
      </form>
    </div>
  </DashboardCard>
</template>

<style scoped>
.choice { display: inline-flex; padding: 3px; background: var(--muted); border-radius: 999px; }
.choice label { padding: 6px 14px; border-radius: 999px; font-size: .9rem; font-weight: 650; cursor: pointer; }
.choice label:has(:checked) { background: var(--background); box-shadow: 0 1px 2px rgb(0 0 0 / .15); }
.choice label:has(:focus-visible) { outline: 3px solid var(--ring); outline-offset: 2px; }
.choice input { position: absolute; opacity: 0; pointer-events: none; }
.secret { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.secret a { min-width: 0; font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; overflow-wrap: anywhere; }
</style>

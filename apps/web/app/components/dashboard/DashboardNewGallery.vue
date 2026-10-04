<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Starts a gallery from a name and the address people will open; the address follows the name until it's edited.
const open = defineModel<boolean>("open", { required: true });
const { mutate: create } = useConvexMutation(api.collections.create);

const name = ref("");
const address = ref("");
const addressEdited = ref(false);
const saving = ref(false);
const error = ref<string>();
const { host } = useGalleryAddress();

watch(name, (value) => {
  if (!addressEdited.value) address.value = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
});

async function submit() {
  saving.value = true;
  error.value = undefined;
  try {
    await create({ title: name.value, subdomain: address.value, description: "" });
    open.value = false;
    await navigateTo(`/admin/galleries/${address.value}`);
    name.value = address.value = "";
    addressEdited.value = false;
  } catch (cause) {
    error.value = readableError(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <form class="grid gap-5" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle class="text-3xl">New gallery</DialogTitle>
          <DialogDescription>You can change these later.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="new-gallery-name">Name</Label>
          <Input id="new-gallery-name" v-model="name" required placeholder="Harbor Summit Lisbon" autocomplete="off" />
        </div>
        <div class="grid gap-2">
          <Label for="new-gallery-address">Page address</Label>
          <div class="flex">
            <Input id="new-gallery-address" v-model="address" class="rounded-r-none" required pattern="[a-z0-9-]+" placeholder="harborsummit" autocomplete="off" @input="addressEdited = true" />
            <span class="flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">.{{ host }}</span>
          </div>
          <p class="text-sm text-muted-foreground">People open this link to find their photos.</p>
        </div>
        <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="line" size="lg" @click="open = false">Cancel</Button>
          <Button type="submit" size="lg" :disabled="saving">{{ saving ? "Creating…" : "Create gallery" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

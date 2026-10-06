<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// New galleries stay private until the owner publishes their secret sharing link.
const open = defineModel<boolean>("open", { required: true });
const { mutate: create } = useConvexMutation(api.collections.create);

const name = ref("");
const saving = ref(false);
const error = ref<string>();
async function submit() {
  saving.value = true;
  error.value = undefined;
  try {
    const id = await create({ title: name.value, description: "" });
    open.value = false;
    await navigateTo(`/admin/galleries/${id}`);
    name.value = "";
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
          <DialogTitle class="text-xl sm:text-3xl">New gallery</DialogTitle>
          <DialogDescription>Only you can see and search it until you publish.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="new-gallery-name">Name</Label>
          <Input id="new-gallery-name" v-model="name" required placeholder="Makers Conf 2026" autocomplete="off" />
        </div>
        <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" @click="open = false">Cancel</Button>
          <Button type="submit" size="lg" :disabled="saving">{{ saving ? "Creating…" : "Create gallery" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

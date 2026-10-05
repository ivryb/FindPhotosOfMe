<script setup lang="ts">
import { Trash2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Gallery } from "@/utils/galleries";

const props = defineProps<{ gallery: Gallery }>();

const deleting = ref(false);
const removing = ref(false);
const deleteError = ref<string>();
async function remove() {
  removing.value = true;
  deleteError.value = undefined;
  try {
    await $fetch(`/api/collections/${props.gallery._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await getConvexAuthToken()}` },
    });
    // The gallery page leaves for the next gallery once the live list drops this one.
    deleting.value = false;
  } catch {
    deleteError.value = "The gallery wasn't deleted. Please try again.";
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <DashboardCard title="Settings">
    <div class="danger">
      <p><b>Delete this gallery</b>Its page stops working and its photos are deleted.</p>
      <Button variant="outline" size="sm" @click="deleting = true"><Trash2 />Delete</Button>
    </div>
  </DashboardCard>

  <Dialog v-model:open="deleting">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle class="text-xl sm:text-3xl">Delete this gallery?</DialogTitle>
        <DialogDescription>Its page stops working and all of its photos are deleted. You can’t undo this.</DialogDescription>
      </DialogHeader>
      <p v-if="deleteError" class="text-sm text-destructive" role="alert">{{ deleteError }}</p>
      <DialogFooter>
        <Button variant="outline" size="lg" @click="deleting = false">Cancel</Button>
        <Button variant="destructive" size="lg" :disabled="removing" @click="remove">{{ removing ? "Deleting…" : "Delete gallery" }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.danger { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; }
.danger p { color: var(--muted-foreground); }
.danger b { display: block; color: var(--foreground); }
</style>

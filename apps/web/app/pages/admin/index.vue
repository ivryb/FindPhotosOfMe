<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableEmpty,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

const { data: collections } = await useConvexSSRQuery(
  api.collections.getAll,
  {}
);

const isDialogOpen = ref(false);

const formData = ref({
  subdomain: "",
  title: "",
  description: "",
});

const { mutate: createCollection } = useConvexMutation(api.collections.create);

const openCreateDialog = () => {
  formData.value = {
    subdomain: "",
    title: "",
    description: "",
  };
  isDialogOpen.value = true;
};

const handleSubmit = async () => {
  try {
    const newCollectionId = await createCollection({
      subdomain: formData.value.subdomain,
      title: formData.value.title,
      description: formData.value.description,
    });

    if (newCollectionId) {
      navigateTo(`/admin/collections/${formData.value.subdomain}`);
    }
    isDialogOpen.value = false;
    // The data will automatically refresh due to Convex reactivity
  } catch (error) {
    console.error("Error saving Collection:", error);
    alert(error instanceof Error ? error.message : "Error saving Collection");
  }
};

const navigateToCollection = (subdomain: string) => {
  navigateTo(`/admin/collections/${subdomain}`);
};
</script>

<template>
  <div class="container mx-auto py-10">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-4xl font-bold">Collection Management</h1>
      </div>
      <Dialog v-model:open="isDialogOpen">
        <DialogTrigger as-child>
          <Button @click="openCreateDialog"> Create New Collection </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Fill in the details for your new Collection.
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <Label for="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                v-model="formData.subdomain"
                placeholder="e.g., itarena2025"
              />
              <p class="text-xs text-muted-foreground">
                This will be used in the Collection URL
              </p>
            </div>
            <div class="grid gap-2">
              <Label for="title">Title</Label>
              <Input
                id="title"
                v-model="formData.title"
                placeholder="e.g., IT Arena 2025"
              />
            </div>
            <div class="grid gap-2">
              <Label for="description">Description</Label>
              <Textarea
                id="description"
                v-model="formData.description"
                placeholder="Collection description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isDialogOpen = false">
              Cancel
            </Button>
            <Button @click="handleSubmit">Create Collection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subdomain</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmpty
          :colspan="4"
          v-if="!collections || collections.length === 0"
        >
          No collections yet. Create your first Collection to get started!
        </TableEmpty>
        <TableRow
          v-for="Collection in collections"
          :key="Collection._id"
          class="cursor-pointer hover:bg-muted/50"
        >
          <TableCell
            class="font-medium"
            @click="navigateToCollection(Collection.subdomain)"
          >
            {{ Collection.subdomain }}
          </TableCell>
          <TableCell @click="navigateToCollection(Collection.subdomain)">
            {{ Collection.title }}
          </TableCell>
          <TableCell
            class="max-w-md truncate"
            @click="navigateToCollection(Collection.subdomain)"
          >
            {{ Collection.description }}
          </TableCell>
          <TableCell @click="navigateToCollection(Collection.subdomain)">
            {{ new Date(Collection._creationTime).toLocaleDateString() }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>

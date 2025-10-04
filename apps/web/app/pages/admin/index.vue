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
import { Label } from "@/components/ui/label";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

const { data: collections } = await useConvexSSRQuery(
  api.collections.getAll,
  {}
);

const isDialogOpen = ref(false);
const isEditing = ref(false);
const currentCollectionId = ref<Id<"collections"> | null>(null);

const formData = ref({
  subdomain: "",
  title: "",
  description: "",
});

const { mutate: createCollection } = useConvexMutation(api.collections.create);
const { mutate: updateCollection } = useConvexMutation(api.collections.update);
const { mutate: deleteCollection } = useConvexMutation(
  api.collections.deleteCollection
);

const openCreateDialog = () => {
  isEditing.value = false;
  currentCollectionId.value = null;
  formData.value = {
    subdomain: "",
    title: "",
    description: "",
  };
  isDialogOpen.value = true;
};

const openEditDialog = (Collection: {
  _id: Id<"collections">;
  subdomain: string;
  title: string;
  description: string;
}) => {
  isEditing.value = true;
  currentCollectionId.value = Collection._id;
  formData.value = {
    subdomain: Collection.subdomain,
    title: Collection.title,
    description: Collection.description,
  };
  isDialogOpen.value = true;
};

const handleSubmit = async () => {
  try {
    if (isEditing.value && currentCollectionId.value) {
      await updateCollection({
        id: currentCollectionId.value,
        subdomain: formData.value.subdomain,
        title: formData.value.title,
        description: formData.value.description,
      });
    } else {
      const newCollectionId = await createCollection({
        subdomain: formData.value.subdomain,
        title: formData.value.title,
        description: formData.value.description,
      });

      if (newCollectionId) {
        navigateTo(`/admin/collections/${formData.value.subdomain}`);
      }
    }
    isDialogOpen.value = false;
    // The data will automatically refresh due to Convex reactivity
  } catch (error) {
    console.error("Error saving Collection:", error);
    alert(error instanceof Error ? error.message : "Error saving Collection");
  }
};

const handleDelete = async (id: Id<"collections">) => {
  if (confirm("Are you sure you want to delete this Collection?")) {
    try {
      await deleteCollection({ id });
    } catch (error) {
      console.error("Error deleting Collection:", error);
      alert("Error deleting Collection");
    }
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
            <DialogTitle>
              {{ isEditing ? "Edit Collection" : "Create New Collection" }}
            </DialogTitle>
            <DialogDescription>
              {{
                isEditing
                  ? "Update the Collection details below."
                  : "Fill in the details for your new Collection."
              }}
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <Label for="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                v-model="formData.subdomain"
                placeholder="e.g., itarena2025"
                :disabled="isEditing"
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
              <Input
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
            <Button @click="handleSubmit">
              {{ isEditing ? "Update Collection" : "Create Collection" }}
            </Button>
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
          <TableHead class="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmpty
          :colspan="5"
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
          <TableCell class="text-right">
            <div class="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="openEditDialog(Collection)"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="handleDelete(Collection._id)"
              >
                Delete
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>

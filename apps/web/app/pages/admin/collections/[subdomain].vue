<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import { ref, computed } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const route = useRoute();
const subdomain = computed(() => route.params.subdomain as string);

const { data: collection } = await useConvexSSRQuery(
  api.collections.getBySubdomain,
  {
    subdomain: subdomain.value,
  }
);

const { mutate: updatecollection } = useConvexMutation(api.collections.update);

const isEditing = ref(false);
const formData = ref({
  subdomain: collection.value?.subdomain || "",
  title: collection.value?.title || "",
  description: collection.value?.description || "",
});

watch(
  () => collection.value,
  (newcollection) => {
    if (newcollection) {
      formData.value = {
        subdomain: newcollection.subdomain,
        title: newcollection.title,
        description: newcollection.description,
      };
    }
  }
);

const handleSave = async () => {
  if (!collection.value) return;

  try {
    await updatecollection({
      id: collection.value._id,
      subdomain: formData.value.subdomain,
      title: formData.value.title,
      description: formData.value.description,
    });
    isEditing.value = false;

    // If subdomain changed, navigate to the new URL
    if (formData.value.subdomain !== subdomain.value) {
      navigateTo(`/admin/collections/${formData.value.subdomain}`);
    }
  } catch (error) {
    console.error("Error updating collection:", error);
    alert(error instanceof Error ? error.message : "Error updating collection");
  }
};

const handleCancel = () => {
  if (collection.value) {
    formData.value = {
      subdomain: collection.value.subdomain,
      title: collection.value.title,
      description: collection.value.description,
    };
  }
  isEditing.value = false;
};
</script>

<template>
  <div class="container mx-auto py-10">
    <div class="mb-6">
      <Button variant="outline" @click="navigateTo('/admin')">
        ← Back to Admin
      </Button>
    </div>

    <div v-if="!collection" class="text-center py-20">
      <h1 class="text-2xl font-bold mb-4">collection Not Found</h1>
      <p class="text-muted-foreground mb-6">
        The collection with subdomain "{{ subdomain }}" does not exist.
      </p>
      <Button @click="navigateTo('/admin')">Go to Admin</Button>
    </div>

    <div v-else>
      <Card>
        <CardHeader>
          <div class="flex justify-between items-start">
            <div>
              <CardTitle class="text-3xl">{{ collection.title }}</CardTitle>
              <CardDescription class="mt-2">
                collection Subdomain: {{ collection.subdomain }}
              </CardDescription>
            </div>
            <Button v-if="!isEditing" @click="isEditing = true">
              Edit collection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="!isEditing" class="space-y-4">
            <div>
              <h3 class="text-sm font-medium text-muted-foreground mb-1">
                Description
              </h3>
              <p class="text-lg">{{ collection.description }}</p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-muted-foreground mb-1">
                Created
              </h3>
              <p class="text-lg">
                {{ new Date(collection._creationTime).toLocaleString() }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-6">
            <div class="grid gap-2">
              <Label for="edit-subdomain">Subdomain</Label>
              <Input
                id="edit-subdomain"
                v-model="formData.subdomain"
                placeholder="e.g., itarena2025"
              />
              <p class="text-xs text-muted-foreground">
                This will be used in the collection URL
              </p>
            </div>
            <div class="grid gap-2">
              <Label for="edit-title">Title</Label>
              <Input
                id="edit-title"
                v-model="formData.title"
                placeholder="e.g., IT Arena 2025"
              />
            </div>
            <div class="grid gap-2">
              <Label for="edit-description">Description</Label>
              <Input
                id="edit-description"
                v-model="formData.description"
                placeholder="collection description"
              />
            </div>
            <div class="flex gap-2">
              <Button @click="handleSave">Save Changes</Button>
              <Button variant="outline" @click="handleCancel">Cancel</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Photos section - to be implemented later -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>
            Photo management functionality coming soon...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="text-center py-10 text-muted-foreground">
            <p>Photo upload and management features will be added here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

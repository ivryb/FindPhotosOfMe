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

const { data: event } = await useConvexSSRQuery(api.events.getBySubdomain, {
  subdomain: subdomain.value,
});

const { mutate: updateEvent } = useConvexMutation(api.events.update);

const isEditing = ref(false);
const formData = ref({
  subdomain: event.value?.subdomain || "",
  title: event.value?.title || "",
  description: event.value?.description || "",
});

watch(
  () => event.value,
  (newEvent) => {
    if (newEvent) {
      formData.value = {
        subdomain: newEvent.subdomain,
        title: newEvent.title,
        description: newEvent.description,
      };
    }
  }
);

const handleSave = async () => {
  if (!event.value) return;

  try {
    await updateEvent({
      id: event.value._id,
      subdomain: formData.value.subdomain,
      title: formData.value.title,
      description: formData.value.description,
    });
    isEditing.value = false;

    // If subdomain changed, navigate to the new URL
    if (formData.value.subdomain !== subdomain.value) {
      navigateTo(`/events/${formData.value.subdomain}`);
    }
  } catch (error) {
    console.error("Error updating event:", error);
    alert(error instanceof Error ? error.message : "Error updating event");
  }
};

const handleCancel = () => {
  if (event.value) {
    formData.value = {
      subdomain: event.value.subdomain,
      title: event.value.title,
      description: event.value.description,
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

    <div v-if="!event" class="text-center py-20">
      <h1 class="text-2xl font-bold mb-4">Event Not Found</h1>
      <p class="text-muted-foreground mb-6">
        The event with subdomain "{{ subdomain }}" does not exist.
      </p>
      <Button @click="navigateTo('/admin')">Go to Admin</Button>
    </div>

    <div v-else>
      <Card>
        <CardHeader>
          <div class="flex justify-between items-start">
            <div>
              <CardTitle class="text-3xl">{{ event.title }}</CardTitle>
              <CardDescription class="mt-2">
                Event Subdomain: {{ event.subdomain }}
              </CardDescription>
            </div>
            <Button v-if="!isEditing" @click="isEditing = true">
              Edit Event
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="!isEditing" class="space-y-4">
            <div>
              <h3 class="text-sm font-medium text-muted-foreground mb-1">
                Description
              </h3>
              <p class="text-lg">{{ event.description }}</p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-muted-foreground mb-1">
                Created
              </h3>
              <p class="text-lg">
                {{ new Date(event._creationTime).toLocaleString() }}
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
                This will be used in the event URL
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
                placeholder="Event description"
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

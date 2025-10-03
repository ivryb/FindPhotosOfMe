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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const { data: events } = await useConvexSSRQuery(api.events.getAll, {});

const isDialogOpen = ref(false);
const isEditing = ref(false);
const currentEventId = ref<Id<"events"> | null>(null);

const formData = ref({
  subdomain: "",
  title: "",
  description: "",
});

const { mutate: createEvent } = useConvexMutation(api.events.create);
const { mutate: updateEvent } = useConvexMutation(api.events.update);
const { mutate: deleteEvent } = useConvexMutation(api.events.deleteEvent);

const openCreateDialog = () => {
  isEditing.value = false;
  currentEventId.value = null;
  formData.value = {
    subdomain: "",
    title: "",
    description: "",
  };
  isDialogOpen.value = true;
};

const openEditDialog = (event: {
  _id: Id<"events">;
  subdomain: string;
  title: string;
  description: string;
}) => {
  isEditing.value = true;
  currentEventId.value = event._id;
  formData.value = {
    subdomain: event.subdomain,
    title: event.title,
    description: event.description,
  };
  isDialogOpen.value = true;
};

const handleSubmit = async () => {
  try {
    if (isEditing.value && currentEventId.value) {
      await updateEvent({
        id: currentEventId.value,
        subdomain: formData.value.subdomain,
        title: formData.value.title,
        description: formData.value.description,
      });
    } else {
      const newEventId = await createEvent({
        subdomain: formData.value.subdomain,
        title: formData.value.title,
        description: formData.value.description,
      });

      if (newEventId) {
        navigateTo(`/events/${formData.value.subdomain}`);
      }
    }
    isDialogOpen.value = false;
    // The data will automatically refresh due to Convex reactivity
  } catch (error) {
    console.error("Error saving event:", error);
    alert(error instanceof Error ? error.message : "Error saving event");
  }
};

const handleDelete = async (id: Id<"events">) => {
  if (confirm("Are you sure you want to delete this event?")) {
    try {
      await deleteEvent({ id });
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Error deleting event");
    }
  }
};

const navigateToEvent = (subdomain: string) => {
  navigateTo(`/events/${subdomain}`);
};
</script>

<template>
  <div class="container mx-auto py-10">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-4xl font-bold">Event Management</h1>
      </div>
      <Dialog v-model:open="isDialogOpen">
        <DialogTrigger as-child>
          <Button @click="openCreateDialog"> Create New Event </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {{ isEditing ? "Edit Event" : "Create New Event" }}
            </DialogTitle>
            <DialogDescription>
              {{
                isEditing
                  ? "Update the event details below."
                  : "Fill in the details for your new event."
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
                This will be used in the event URL
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
                placeholder="Event description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isDialogOpen = false">
              Cancel
            </Button>
            <Button @click="handleSubmit">
              {{ isEditing ? "Update Event" : "Create Event" }}
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
        <TableEmpty :colspan="5" v-if="!events || events.length === 0">
          No events yet. Create your first event to get started!
        </TableEmpty>
        <TableRow
          v-for="event in events"
          :key="event._id"
          class="cursor-pointer hover:bg-muted/50"
        >
          <TableCell
            class="font-medium"
            @click="navigateToEvent(event.subdomain)"
          >
            {{ event.subdomain }}
          </TableCell>
          <TableCell @click="navigateToEvent(event.subdomain)">
            {{ event.title }}
          </TableCell>
          <TableCell
            class="max-w-md truncate"
            @click="navigateToEvent(event.subdomain)"
          >
            {{ event.description }}
          </TableCell>
          <TableCell @click="navigateToEvent(event.subdomain)">
            {{ new Date(event._creationTime).toLocaleDateString() }}
          </TableCell>
          <TableCell class="text-right">
            <div class="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="openEditDialog(event)"
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="handleDelete(event._id)"
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

<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import { ref, computed } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
} from "lucide-vue-next";

const route = useRoute();
const config = useRuntimeConfig();
const subdomain = computed(() => route.params.subdomain as string);

const { data: collection } = await useConvexSSRQuery(
  api.collections.getBySubdomain,
  {
    subdomain: subdomain.value,
  }
);

const { mutate: updatecollection } = useConvexMutation(api.collections.update);
const { mutate: deletecollection } = useConvexMutation(
  api.collections.deleteCollection
);

// Edit form state
const isEditing = ref(false);

// Delete dialog state
const isDeleteDialogOpen = ref(false);
const isDeleting = ref(false);
const formData = ref({
  subdomain: collection.value?.subdomain || "",
  title: collection.value?.title || "",
  description: collection.value?.description || "",
});

// Upload state
const selectedFile = ref<File | null>(null);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);

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

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    if (!file.name.endsWith(".zip")) {
      uploadError.value = "Please select a valid zip file";
      selectedFile.value = null;
      return;
    }
    selectedFile.value = file;
    uploadError.value = null;
  }
};

const handleUpload = async () => {
  if (!selectedFile.value || !collection.value) return;

  isUploading.value = true;
  uploadError.value = null;

  try {
    const formData = new FormData();
    formData.append("collection_id", collection.value._id);
    formData.append("file", selectedFile.value);

    const apiURL = config.public.apiURL;
    if (!apiURL) {
      throw new Error(
        "API URL not configured. Please set NUXT_PUBLIC_API_URL environment variable."
      );
    }

    console.log(
      `[Upload] Starting upload for collection: ${collection.value._id}`
    );
    console.log(
      `[Upload] File: ${selectedFile.value.name} (${formatFileSize(selectedFile.value.size)})`
    );
    console.log(`[Upload] API URL: ${apiURL}`);

    const response = await fetch(`${apiURL}/api/upload-collection`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "Upload failed");
    }

    console.log(`[Upload] Success: ${result.message}`);
    console.log(`[Upload] Images processed: ${result.images_processed}`);

    // Reset form
    selectedFile.value = null;
    const fileInput = document.getElementById("zip-file") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  } catch (error) {
    console.error("[Upload] Error:", error);
    uploadError.value =
      error instanceof Error ? error.message : "Failed to upload file";
  } finally {
    isUploading.value = false;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const handleDelete = async () => {
  if (!collection.value) return;

  isDeleting.value = true;
  try {
    console.log(`[Delete] Deleting collection: ${collection.value._id}`);
    await deletecollection({ id: collection.value._id });
    console.log(`[Delete] Collection deleted successfully`);
    isDeleteDialogOpen.value = false;
    navigateTo("/admin");
  } catch (error) {
    console.error("[Delete] Error deleting collection:", error);
    alert(
      error instanceof Error ? error.message : "Failed to delete collection"
    );
  } finally {
    isDeleting.value = false;
  }
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
            <div v-if="!isEditing" class="flex gap-2">
              <Button @click="isEditing = true"> Edit collection </Button>
              <Dialog v-model:open="isDeleteDialogOpen">
                <DialogTrigger as-child>
                  <Button variant="destructive">
                    <Trash2 class="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Collection</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete "{{ collection.title }}"?
                      This action cannot be undone and will permanently delete
                      all associated data.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      @click="isDeleteDialogOpen = false"
                      :disabled="isDeleting"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      @click="handleDelete"
                      :disabled="isDeleting"
                    >
                      <Loader2
                        v-if="isDeleting"
                        class="mr-2 h-4 w-4 animate-spin"
                      />
                      <span v-if="isDeleting">Deleting...</span>
                      <span v-else>Delete Collection</span>
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
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
              <Textarea
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

      <!-- Photos Upload section -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Photo Collection Upload</CardTitle>
          <CardDescription>
            Upload a zip archive containing photos for face recognition
            processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Status Display -->
          <div v-if="collection.status !== 'not_started'" class="mb-6">
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-sm font-medium">Status:</span>
                <Badge
                  :variant="
                    collection.status === 'processing'
                      ? 'default'
                      : collection.status === 'complete'
                        ? 'outline'
                        : 'destructive'
                  "
                >
                  {{ collection.status.toUpperCase() }}
                </Badge>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm font-medium">Images Processed:</span>
                <span class="text-sm">{{ collection.imagesCount }}</span>
              </div>
            </div>
          </div>

          <!-- Upload Form -->
          <div
            v-if="
              collection.status === 'not_started' ||
              collection.status === 'error'
            "
          >
            <div class="space-y-4">
              <div class="grid gap-2">
                <Label for="zip-file">Select Zip Archive</Label>
                <Input
                  id="zip-file"
                  type="file"
                  accept=".zip"
                  @change="handleFileSelect"
                  :disabled="isUploading"
                />
                <p class="text-xs text-muted-foreground">
                  Upload a zip file containing photos (.jpg, .jpeg, .png)
                </p>
              </div>

              <div v-if="selectedFile" class="text-sm">
                <span class="font-medium">Selected file:</span>
                {{ selectedFile.name }} ({{
                  formatFileSize(selectedFile.size)
                }})
              </div>

              <Button
                @click="handleUpload"
                :disabled="!selectedFile || isUploading"
                class="w-full"
              >
                <Loader2 v-if="isUploading" class="mr-2 h-4 w-4 animate-spin" />
                <Upload v-else class="mr-2 h-4 w-4" />
                <span v-if="isUploading">Uploading...</span>
                <span v-else>Upload and Process</span>
              </Button>

              <div
                v-if="uploadError"
                class="flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle class="h-4 w-4" />
                <span>{{ uploadError }}</span>
              </div>
            </div>
          </div>

          <!-- Processing State -->
          <div
            v-else-if="collection.status === 'processing'"
            class="text-center py-8"
          >
            <div class="space-y-4">
              <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/20 border-2 border-secondary"
              >
                <Loader2
                  class="h-8 w-8 text-secondary-foreground animate-spin"
                />
              </div>
              <div>
                <h3 class="text-lg font-semibold">Processing Photos</h3>
                <p class="text-muted-foreground">
                  Extracting face embeddings and uploading to storage...
                </p>
                <p class="text-lg font-medium mt-2">
                  {{ collection.imagesCount }} images processed
                </p>
              </div>
            </div>
          </div>

          <!-- Complete State -->
          <div
            v-else-if="collection.status === 'complete'"
            class="text-center py-8"
          >
            <div class="space-y-4">
              <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border-2 border-primary"
              >
                <CheckCircle2 class="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 class="text-lg font-semibold">Upload Complete!</h3>
                <p class="text-muted-foreground">
                  Successfully processed {{ collection.imagesCount }} images
                  <br />
                  Collection is ready for face recognition searches
                </p>
                <p class="text-sm text-muted-foreground mt-2"></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

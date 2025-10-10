<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { useConvexMutation, useConvexClient } from "convex-vue";
import { ref, computed } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

const convex = useConvexClient();

const { mutate: updatecollection } = useConvexMutation(api.collections.update);
const { mutate: deleteCollection } = useConvexMutation(
  api.collections.deleteCollection
);

const { mutate: setTelegramToken } = useConvexMutation(
  api.collections.storeTelegramBotToken
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
  telegramBotToken: collection.value?.telegramBotToken || "",
  welcomeMessage: collection.value?.welcomeMessage || "",
});

// Upload state (multi-file)
const selectedFiles = ref<File[]>([]);
const fileInputRef = ref<any>(null);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);
const uploadProgress = ref(0);
const uploadStage = ref<"idle" | "uploading" | "starting">("idle");
const showLoader = computed(() => uploadStage.value !== "idle");
const loaderTitle = computed(() => {
  if (uploadStage.value === "uploading") return "Uploading...";
  if (uploadStage.value === "starting") return "Starting processing...";
  return "";
});
const loaderDescription = computed(() => {
  if (uploadStage.value === "uploading")
    return "Sending your archive to cloud storage";
  if (uploadStage.value === "starting")
    return "Initializing face recognition on the server";
  return "";
});

watch(
  () => collection.value,
  (newcollection) => {
    if (newcollection) {
      formData.value = {
        subdomain: newcollection.subdomain,
        title: newcollection.title,
        description: newcollection.description,
        telegramBotToken: newcollection.telegramBotToken || "",
        welcomeMessage: newcollection.welcomeMessage || "",
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
      welcomeMessage: formData.value.welcomeMessage || undefined,
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

const isSettingTelegram = ref(false);
const telegramError = ref<string | null>(null);
const handleSetTelegram = async () => {
  if (!collection.value) return;
  isSettingTelegram.value = true;
  telegramError.value = null;
  try {
    await setTelegramToken({
      id: collection.value._id,
      token: formData.value.telegramBotToken,
    });
    console.log("Telegram token updated and webhook scheduled");
  } catch (err: any) {
    console.error("Error setting Telegram token:", err);
    telegramError.value = err?.message || "Failed to set Telegram token";
  } finally {
    isSettingTelegram.value = false;
  }
};

const handleCancel = () => {
  if (collection.value) {
    formData.value = {
      subdomain: collection.value.subdomain,
      title: collection.value.title,
      description: collection.value.description,
      telegramBotToken: collection.value.telegramBotToken || "",
      welcomeMessage: collection.value.welcomeMessage || "",
    };
  }
  isEditing.value = false;
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files ? Array.from(target.files) : [];
  const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
  if (zips.length !== files.length) {
    uploadError.value = "Only .zip files are allowed";
  } else {
    uploadError.value = null;
  }
  selectedFiles.value = zips;
};

const handleUpload = async () => {
  if (!collection.value || selectedFiles.value.length === 0) return;

  isUploading.value = true;
  uploadError.value = null;
  uploadProgress.value = 0;
  uploadStage.value = "uploading";

  try {
    const apiURL = config.public.apiURL;
    if (!apiURL) {
      throw new Error(
        "API URL not configured. Please set NUXT_PUBLIC_API_URL environment variable."
      );
    }

    const contentType = "application/zip";
    const jobs: { filename: string; fileKey: string }[] = [];

    // 1) Upload each file to R2
    for (const file of selectedFiles.value) {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const r2Key = `uploads/${collection.value._id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}-${sanitizedName}`;

      const presign = await $fetch<{
        success: boolean;
        url: string;
        headers: Record<string, string>;
        key: string;
      }>("/api/r2/presign-upload", {
        method: "POST",
        body: { key: r2Key, contentType },
      });

      await $fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
        responseType: "text",
      });

      jobs.push({ filename: sanitizedName, fileKey: r2Key });
    }

    uploadStage.value = "starting";

    // 2) Create ingest jobs in Convex
    const jobIds = await convex.mutation(api.ingestJobs.createBatch, {
      jobs: jobs.map((j) => ({
        collectionId: collection.value!._id as Id<"collections">,
        filename: j.filename,
        fileKey: j.fileKey,
      })),
    });

    // 3) Ask Convex to dispatch the next job for this collection (per-job request to Python)
    await convex.action(api.ingest.dispatchNextForCollection, {
      collectionId: collection.value!._id as Id<"collections">,
    });

    // Reset input
    selectedFiles.value = [];
    uploadProgress.value = 0;
    if (fileInputRef.value && fileInputRef.value.$el) {
      fileInputRef.value.$el.value = "";
    }
  } catch (error) {
    console.error("[Upload] Error:", error);
    uploadError.value =
      error instanceof Error ? error.message : "Failed to upload files";
    uploadProgress.value = 0;
  } finally {
    isUploading.value = false;
    uploadStage.value = "idle";
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
    await deleteCollection({ id: collection.value._id });
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
            <div class="grid gap-2">
              <Label for="telegram-token">Telegram Bot Token</Label>
              <Input
                id="telegram-token"
                v-model="formData.telegramBotToken"
                placeholder="e.g., 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              />
              <div class="flex gap-2 items-center">
                <Button
                  @click="handleSetTelegram"
                  :disabled="isSettingTelegram"
                >
                  <Loader2
                    v-if="isSettingTelegram"
                    class="mr-2 h-4 w-4 animate-spin"
                  />
                  <span v-if="isSettingTelegram">Saving...</span>
                  <span v-else>Save Telegram Token</span>
                </Button>
                <p v-if="telegramError" class="text-sm text-destructive">
                  {{ telegramError }}
                </p>
              </div>
              <p class="text-xs text-muted-foreground">
                After saving, webhook will be set automatically for this
                collection bot.
              </p>
            </div>
            <div class="grid gap-2">
              <Label for="welcome-message">Welcome Message</Label>
              <Textarea
                id="welcome-message"
                v-model="formData.welcomeMessage"
                placeholder="Hi! This bot will help you *find photos of yourself*..."
                rows="8"
              />
              <p class="text-xs text-muted-foreground">
                Custom welcome message for Telegram bot. Use {IMAGES_COUNT} to
                show the number of photos. Supports MarkdownV2 formatting.
              </p>
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
          <div v-if="collection.status !== 'not_started'">
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

          <!-- Unified Loader State -->
          <div v-if="showLoader" class="text-center py-8">
            <div class="space-y-4">
              <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20"
              >
                <Loader2 class="h-8 w-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 class="text-lg font-semibold">{{ loaderTitle }}</h3>
                <p class="text-sm text-muted-foreground mt-1">
                  {{ loaderDescription }}
                </p>
              </div>
            </div>
          </div>

          <!-- Upload Form or Idle -->
          <div v-else>
            <div class="space-y-4">
              <div class="grid gap-2">
                <Label for="zip-file">Select Zip Archives</Label>
                <Input
                  id="zip-file"
                  type="file"
                  accept=".zip"
                  multiple
                  ref="fileInputRef"
                  @change="handleFileSelect"
                  :disabled="isUploading"
                />
                <p class="text-xs text-muted-foreground">
                  Select one or more .zip files to append into this collection
                </p>
              </div>

              <div v-if="selectedFiles.length > 0" class="text-sm space-y-1">
                <span class="font-medium">Selected files:</span>
                <div
                  v-for="f in selectedFiles"
                  :key="f.name"
                  class="text-muted-foreground"
                >
                  {{ f.name }} ({{ formatFileSize(f.size) }})
                </div>
              </div>

              <!-- Upload Progress -->
              <div v-if="isUploading && uploadProgress > 0" class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">Uploading file...</span>
                  <span class="font-medium">{{ uploadProgress }}%</span>
                </div>
                <Progress :model-value="uploadProgress" class="w-full" />
              </div>

              <Button
                @click="handleUpload"
                :disabled="selectedFiles.length === 0 || isUploading"
                class="w-full"
              >
                <Loader2 v-if="isUploading" class="mr-2 h-4 w-4 animate-spin" />
                <Upload v-else class="mr-2 h-4 w-4" />
                <span v-if="isUploading">Uploading...</span>
                <span v-else>Upload and Queue</span>
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
        </CardContent>
      </Card>

      <!-- Ingest jobs list -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Ingest Jobs</CardTitle>
          <CardDescription
            >Queued uploads and their processing status</CardDescription
          >
        </CardHeader>
        <CardContent>
          <IngestJobsTable :collection-id="collection._id" />
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, Search, XCircle, ImageIcon } from "lucide-vue-next";
import SearchProgress from "@/components/SearchProgress.vue";

const props = defineProps<{
  collectionId: Id<"collections">;
}>();

const config = useRuntimeConfig();
const { mutate: createSearchRequest } = useConvexMutation(
  api.searchRequests.create
);

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const isUploading = ref(false);
const error = ref<string | null>(null);
const searchRequestId = ref<Id<"searchRequests"> | null>(null);
const hasStartedSearch = ref(false);

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("image/")) {
    error.value = "Please select a valid image file";
    return;
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    error.value = "Image size must be less than 10MB";
    return;
  }

  selectedFile.value = file;
  error.value = null;

  // Create preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

async function startSearch() {
  if (!selectedFile.value) {
    error.value = "Please select a photo first";
    return;
  }

  isUploading.value = true;
  error.value = null;

  try {
    // Create search request in Convex
    console.log("Creating search request for collection:", props.collectionId);
    const requestId = await createSearchRequest({
      collectionId: props.collectionId,
    });

    searchRequestId.value = requestId;
    hasStartedSearch.value = true;
    console.log("Search request created:", requestId);

    // Prepare form data
    const formData = new FormData();
    formData.append("search_request_id", requestId);
    formData.append("reference_photo", selectedFile.value);

    // Send to Python service
    const apiUrl = config.public.apiURL;
    console.log("Sending search request to:", `${apiUrl}/api/search-photos`);

    const response = await fetch(`${apiUrl}/api/search-photos`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: "Unknown error" }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log("Search started successfully:", result);
  } catch (err: any) {
    console.error("Search error:", err);
    error.value = err.message || "Failed to start search";
  } finally {
    isUploading.value = false;
  }
}

function resetForm() {
  selectedFile.value = null;
  previewUrl.value = null;
  error.value = null;
  searchRequestId.value = null;
  hasStartedSearch.value = false;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Upload Form -->
    <Card v-if="!hasStartedSearch">
      <CardHeader>
        <div class="flex items-center gap-2">
          <Upload :size="24" class="text-primary" />
          <CardTitle>Find Your Photos</CardTitle>
        </div>
        <CardDescription>
          Upload a clear photo of yourself, and we'll find all photos where you
          appear in this collection
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="photo-upload">Your Photo</Label>
          <Input
            id="photo-upload"
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            :disabled="isUploading"
          />
          <p class="text-sm text-muted-foreground">
            Upload a photo showing your face clearly (max 10MB)
          </p>
        </div>

        <!-- Preview -->
        <div v-if="previewUrl" class="space-y-2">
          <Label>Preview</Label>
          <div class="relative inline-block">
            <img
              :src="previewUrl"
              alt="Preview"
              class="max-w-xs rounded-lg border border-border"
            />
            <div
              class="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1"
            >
              <ImageIcon :size="16" />
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div
          v-if="error"
          class="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/20"
        >
          <XCircle :size="18" class="flex-shrink-0 mt-0.5" />
          <span>{{ error }}</span>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2">
          <Button
            @click="startSearch"
            :disabled="!selectedFile || isUploading"
            class="flex-1 gap-2"
          >
            <Search :size="18" v-if="!isUploading" />
            {{ isUploading ? "Starting Search..." : "Search for My Photos" }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Search Progress and Results -->
    <SearchProgress
      v-if="hasStartedSearch && searchRequestId"
      :search-request-id="searchRequestId"
      @reset="resetForm"
    />
  </div>
</template>

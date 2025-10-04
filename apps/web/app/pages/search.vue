<script setup lang="ts">
import { useSubdomain } from "@/composables/useSubdomain";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Images } from "lucide-vue-next";
import SearchForm from "@/components/SearchForm.vue";
import { marked } from "marked";

const subdomain = useSubdomain();

if (!subdomain) {
  navigateTo("/");
}

// Fetch collection by subdomain
const { data: collection, error: collectionError } = await useConvexSSRQuery(
  api.collections.getBySubdomain,
  { subdomain: subdomain || "" }
);

// If collection not found or not ready, show error
if (!collection.value || collection.value.status !== "complete") {
  throw createError({
    statusCode: 404,
    statusMessage: "Event not found or not ready yet",
  });
}

const previewImages = computed(() => {
  const list = (collection.value as any)?.previewImages as string[] | undefined;
  return (list || []).slice(0, 20);
});

const descriptionHtml = computed(() => {
  return marked.parse(collection.value?.description || "");
});
</script>

<template>
  <div class="container max-w-4xl py-8 space-y-8">
    <!-- Event Information -->
    <Card>
      <CardHeader>
        <div class="space-y-4">
          <CardTitle class="text-3xl">{{ collection?.title }}</CardTitle>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Images :size="20" />
            <span
              >{{ collection?.imagesCount.toLocaleString() }} photos in this
              collection</span
            >
          </div>
          <div v-if="previewImages.length" class="grid grid-cols-5 gap-1">
            <div
              v-for="(key, idx) in previewImages"
              :key="idx"
              class="relative aspect-square overflow-hidden rounded-sm"
            >
              <img
                :src="`/api/r2/${key}`"
                alt="Preview"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <CardDescription
          class="text-base mt-4 prose prose-sm dark:prose-invert max-w-none"
        >
          <div v-html="descriptionHtml"></div>
        </CardDescription>
      </CardHeader>
      <CardContent> </CardContent>
    </Card>

    <!-- Search Form -->
    <SearchForm v-if="collection" :collection-id="collection._id" />
  </div>
</template>

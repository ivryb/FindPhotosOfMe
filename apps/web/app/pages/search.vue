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

const statusColor = computed(() => {
  switch (collection.value?.status) {
    case "complete":
      return "bg-chart-4";
    case "processing":
      return "bg-chart-2";
    case "error":
      return "bg-destructive";
    default:
      return "bg-muted";
  }
});
</script>

<template>
  <div class="container max-w-4xl py-8 space-y-8">
    <!-- Event Information -->
    <Card>
      <CardHeader>
        <div class="space-y-2">
          <CardTitle class="text-3xl">{{ collection?.title }}</CardTitle>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Images :size="20" />
            <span
              >{{ collection?.imagesCount.toLocaleString() }} photos in this
              collection</span
            >
          </div>
        </div>
        <CardDescription class="text-base mt-4">
          {{ collection?.description }}
        </CardDescription>
      </CardHeader>
      <CardContent> </CardContent>
    </Card>

    <!-- Search Form -->
    <SearchForm v-if="collection" :collection-id="collection._id" />
  </div>
</template>

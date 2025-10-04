<script setup lang="ts">
import { computed } from "vue";
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexQuery } from "convex-vue";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  CheckCircle2,
  XCircle,
  Upload,
  ImageIcon,
} from "lucide-vue-next";

const props = defineProps<{
  searchRequestId: Id<"searchRequests">;
}>();

const emit = defineEmits<{
  reset: [];
}>();

const config = useRuntimeConfig();

// Query the search request directly
const { data: searchRequest } = useConvexQuery(api.searchRequests.get, {
  id: props.searchRequestId,
});

const progress = computed(() => {
  if (!searchRequest.value || !searchRequest.value.totalImages) return 0;
  const processed = searchRequest.value.processedImages || 0;
  return (processed / searchRequest.value.totalImages) * 100;
});

const isSearching = computed(() => {
  return (
    searchRequest.value &&
    (searchRequest.value.status === "pending" ||
      searchRequest.value.status === "processing")
  );
});

const foundPhotos = computed(() => {
  if (!searchRequest.value || !searchRequest.value.imagesFound) return [];
  return searchRequest.value.imagesFound;
});

function handleReset() {
  emit("reset");
}
</script>

<template>
  <div class="space-y-6">
    <!-- Search Progress -->
    <Card v-if="isSearching" class="border-accent">
      <CardHeader>
        <div class="flex items-center gap-2">
          <Search :size="24" class="text-accent animate-pulse" />
          <CardTitle>Searching...</CardTitle>
        </div>
        <CardDescription>
          We're comparing your photo with
          {{ searchRequest?.totalImages || "..." }} images
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span class="font-medium text-foreground"
              >{{ searchRequest?.processedImages || 0 }} /
              {{ searchRequest?.totalImages || 0 }}</span
            >
          </div>
          <Progress :model-value="progress" class="h-2" />
        </div>

        <!-- Early Results -->
        <div
          v-if="foundPhotos.length > 0"
          class="flex items-center gap-2 p-3 bg-chart-4/10 text-chart-4 rounded-lg border border-chart-4/20"
        >
          <CheckCircle2 :size="18" />
          <p class="text-sm font-medium">
            Found {{ foundPhotos.length }} photo{{
              foundPhotos.length !== 1 ? "s" : ""
            }}
            so far!
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Search Complete -->
    <Card v-if="searchRequest?.status === 'complete'" class="border-chart-4">
      <CardHeader>
        <div class="flex items-center gap-2">
          <CheckCircle2 :size="24" class="text-chart-4" />
          <CardTitle>Search Complete!</CardTitle>
        </div>
        <CardDescription>
          Found {{ foundPhotos.length }} photo{{
            foundPhotos.length !== 1 ? "s" : ""
          }}
          of you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button @click="handleReset" variant="outline" class="gap-2">
          <Search :size="18" />
          Search Again
        </Button>
      </CardContent>
    </Card>

    <!-- Error State -->
    <Card v-if="searchRequest?.status === 'error'" class="border-destructive">
      <CardHeader>
        <div class="flex items-center gap-2">
          <XCircle :size="24" class="text-destructive" />
          <CardTitle>Search Failed</CardTitle>
        </div>
        <CardDescription class="text-destructive">
          Something went wrong. Please try again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button @click="handleReset" class="gap-2">
          <Upload :size="18" />
          Try Again
        </Button>
      </CardContent>
    </Card>

    <!-- Results Grid -->
    <div v-if="foundPhotos.length > 0" class="space-y-4">
      <div class="flex items-center gap-2">
        <ImageIcon :size="24" class="text-primary" />
        <h3 class="text-xl font-semibold">Your Photos</h3>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="(photoPath, index) in foundPhotos"
          :key="index"
          class="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary transition-colors group"
        >
          <img
            :src="`/api/r2/${photoPath}`"
            :alt="`Match ${index + 1}`"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2"
          >
            <span class="text-xs font-medium text-foreground"
              >Photo {{ index + 1 }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

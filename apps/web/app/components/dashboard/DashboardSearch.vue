<script setup lang="ts">
import type { GalleryPhoto } from "#shared/types/gallery";
import type { Gallery } from "@/utils/galleries";

defineProps<{ gallery: Gallery }>();

const viewer = reactive<{ open: boolean; index: number; photos: GalleryPhoto[] }>({ open: false, index: 0, photos: [] });
function view(photos: GalleryPhoto[], index: number) {
  Object.assign(viewer, { open: true, index, photos });
}

</script>

<template>
  <DashboardCard title="Search">
    <template #aside><p>{{ count.format(gallery.imagesCount) }} photos ready to search</p></template>
    <template v-if="gallery.imagesCount">
      <GallerySearch :gallery-id="gallery._id" :total="gallery.imagesCount" owner inline @view="view" />
      <GalleryViewer v-model:open="viewer.open" v-model:index="viewer.index" :photos="viewer.photos" />
    </template>
    <p v-else class="text-muted-foreground">Photos will be searchable once they finish processing. <NuxtLink :to="{ query: {} }" class="font-semibold text-foreground underline underline-offset-4" replace>Upload photos</NuxtLink> to get started.</p>
  </DashboardCard>
</template>

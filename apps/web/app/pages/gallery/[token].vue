<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";

const route = useRoute();
const shareToken = typeof route.params.token === "string" ? route.params.token : "";
const { data: gallery } = await useConvexSSRQuery(api.collections.getPublicByToken, { shareToken });
if (!gallery.value) throw createError({ statusCode: 404, statusMessage: "This gallery isn’t online" });
useSeoMeta({ title: () => `${gallery.value?.title ?? "Gallery"} photos`, robots: "noindex, nofollow, noarchive" });
useHead({ bodyAttrs: { style: "background: #151515" }, meta: [{ name: "referrer", content: "no-referrer" }] });
</script>

<template>
  <GalleryPage v-if="gallery" :key="shareToken" :gallery="gallery" :share-token="shareToken" />
  <p v-else class="p-8">This gallery isn’t online.</p>
</template>

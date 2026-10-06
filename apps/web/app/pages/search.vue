<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useSubdomain } from "@/composables/useSubdomain";

// A gallery's public page, opened from its own subdomain: every photo, and a selfie search over them.
const subdomain = useSubdomain();
if (!subdomain) await navigateTo("/");
const { data: gallery } = await useConvexSSRQuery(api.collections.getPublicBySubdomain, { subdomain: subdomain ?? "" });
if (!gallery.value) throw createError({ statusCode: 404, statusMessage: "This gallery isn’t online" });
const current = computed(() => gallery.value);

useSeoMeta({
  title: () => `${current.value?.title ?? "Gallery"} photos`,
  description: () => `Find the photos you’re in from ${current.value?.title ?? "Gallery"} with a selfie.`,
});
useHead({ bodyAttrs: { style: "background: #151515" } });
// The link preview is drawn from the gallery's previews (server/routes/og); without any, the site's image stays.
if (current.value?.previewImages.length) useSeoMeta({ ogImage: `${useRequestURL().origin}/og/${subdomain}` });

</script>

<template>
  <GalleryPage v-if="current" :gallery="current" />
  <p v-else class="p-8">This gallery isn’t online.</p>
</template>

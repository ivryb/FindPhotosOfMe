<script setup lang="ts">
// Link previews show the page's title ("%s") and the site image (Lens, round 2 in design/og), unless a page sets its
// own image, as gallery pages do.
useSeoMeta({
  ogTitle: "%s",
  ogImage: `${useRequestURL().origin}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: "summary_large_image",
});
</script>

<template>
  <NuxtLoadingIndicator color="var(--brand)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

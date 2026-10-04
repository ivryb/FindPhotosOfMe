<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";

// One gallery's dashboard: its header and QR code, then photos, page settings, and the bot in tabs.
const route = useRoute();
const { galleries, credit, toppingUp } = useDashboard();
// Only the owner's own galleries are ever loaded, so someone else's address looks the same as a missing one.
const id = galleries.value.find((item) => item.subdomain === route.params.subdomain)?._id;
if (!id) throw createError({ statusCode: 404, statusMessage: "Gallery not found" });
// Found by address once, then followed by ID: a rename keeps the page until it moves to the new address,
// and a deleted gallery leaves for the next one.
const gallery = computed(() => galleries.value.find((item) => item._id === id));
watch(gallery, (current) => current || navigateTo("/admin", { replace: true }));

useSeoMeta({ title: () => `${gallery.value?.title ?? "Gallery"} · FindPhotosOfMe` });

const TABS = [
  { value: "photos", label: "Photos" },
  { value: "page", label: "Gallery page" },
  { value: "bot", label: "Telegram bot" },
];
const tab = computed({
  get: () => (TABS.some(({ value }) => value === route.query.tab) ? String(route.query.tab) : "photos"),
  set: (value: string) => navigateTo({ query: value === "photos" ? {} : { tab: value } }, { replace: true }),
});
</script>

<template>
  <template v-if="gallery">
    <DashboardGalleryHead :gallery="gallery" />
    <TabsRoot v-model="tab" class="tabs" :unmount-on-hide="false">
      <TabsList class="tab-list" aria-label="Gallery settings">
        <TabsTrigger v-for="{ value, label } in TABS" :key="value" :value="value">{{ label }}</TabsTrigger>
      </TabsList>
      <TabsContent value="photos"><DashboardPhotos :gallery="gallery" :credit="credit" @top-up="toppingUp = true" /></TabsContent>
      <TabsContent value="page"><DashboardPageSettings :gallery="gallery" /></TabsContent>
      <TabsContent value="bot"><DashboardBot :gallery="gallery" /></TabsContent>
    </TabsRoot>
  </template>
</template>

<style scoped>
.tabs { margin-top: 28px; }
.tab-list { display: flex; gap: 4px; border-bottom: 2px solid var(--foreground); }
.tab-list button { padding: 12px 18px; border-radius: 8px 8px 0 0; color: var(--muted-foreground); font-weight: 700; font-stretch: 110%; white-space: nowrap; cursor: pointer; }
.tab-list button:hover { color: var(--foreground); }
.tab-list button[data-state="active"] { background: var(--foreground); color: var(--background); }
.tabs :deep([role="tabpanel"] > section) { border-top-left-radius: 0; }
@media (max-width: 600px) { .tab-list { overflow-x: auto; } }
</style>

<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";

// One gallery's dashboard: its header and QR code, then upload, search, and settings sections.
const route = useRoute();
const { galleries, credit, toppingUp } = useDashboard();
// Only the owner's own galleries are ever loaded, so someone else's address looks the same as a missing one.
const id = galleries.value.find((item) => item._id === route.params.subdomain || item.subdomain === route.params.subdomain)?._id;
if (!id) throw createError({ statusCode: 404, statusMessage: "Gallery not found" });
// Found by address once, then followed by ID: a rename keeps the page until it moves to the new address,
// and a deleted gallery returns to the list.
const gallery = computed(() => galleries.value.find((item) => item._id === id));
watch(gallery, (current) => current || navigateTo("/admin", { replace: true }));

useSeoMeta({ title: () => `${gallery.value?.title ?? "Gallery"} · FindPhotosOfMe` });

const TABS = [
  { value: "photos", label: "Upload photos" },
  { value: "search", label: "Search" },
  { value: "page", label: "Gallery page" },
  { value: "bot", label: "Telegram bot" },
  { value: "settings", label: "Settings" },
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
      <nav class="section-menu" aria-label="Gallery sections">
        <NuxtLink v-for="{ value, label } in TABS" :key="value" :to="{ query: value === 'photos' ? {} : { tab: value } }" :aria-current="tab === value ? 'page' : undefined" replace>{{ label }}</NuxtLink>
      </nav>
      <TabsList class="tab-list" aria-label="Gallery settings">
        <TabsTrigger v-for="{ value, label } in TABS" :key="value" :value="value">{{ label }}</TabsTrigger>
      </TabsList>
      <TabsContent value="photos"><DashboardPhotos :gallery="gallery" :credit="credit" @top-up="toppingUp = true" /></TabsContent>
      <TabsContent value="search"><DashboardSearch :gallery="gallery" /></TabsContent>
      <TabsContent value="page"><DashboardPageSettings :gallery="gallery" /></TabsContent>
      <TabsContent value="bot"><DashboardBot :gallery="gallery" /></TabsContent>
      <TabsContent value="settings"><DashboardGallerySettings :gallery="gallery" /></TabsContent>
    </TabsRoot>
  </template>
</template>

<style scoped>
.tabs { margin-top: 28px; }
.section-menu { display: none; }
.tab-list { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 2px solid var(--foreground); }
.tab-list button { padding: 12px 18px; border-radius: 8px 8px 0 0; color: var(--muted-foreground); font-weight: 700; font-stretch: 110%; white-space: nowrap; cursor: pointer; }
.tab-list button:hover { color: var(--foreground); }
.tab-list button[data-state="active"] { background: var(--foreground); color: var(--background); }
/* The first card of each tab hangs from the tabs, also when the tab wraps its cards to catch dropped files */
.tabs :deep([role="tabpanel"] > section), .tabs :deep([role="tabpanel"] > div > section:first-child) { border-top-left-radius: 0; }
@media (max-width: 900px) {
  .tabs { margin-top: 24px; }
  .tab-list { display: none; }
  .section-menu { display: grid; gap: 2px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
  .section-menu a { display: flex; align-items: center; min-height: 44px; padding: 8px 12px; border-left: 3px solid transparent; border-radius: 4px; color: var(--muted-foreground); font-size: .95rem; font-weight: 600; }
  .section-menu a:hover { color: var(--foreground); background: var(--muted); }
  .section-menu a[aria-current="page"] { color: var(--foreground); background: var(--muted); border-left-color: var(--brand); }
}
</style>

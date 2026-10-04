<script setup lang="ts">
// The frame around every dashboard page. Loading here, once, keeps galleries and balance live while moving between pages.
await provideDashboard();
</script>

<template>
  <DashboardShell>
    <NuxtPage />
  </DashboardShell>
</template>

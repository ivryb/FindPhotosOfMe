<script setup lang="ts">
import { useSubdomain } from "@/composables/useSubdomain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";

// const { data: healthCheck } = await useConvexSSRQuery(api.healthCheck.get, {});

// const { data: todos } = await useConvexSSRQuery(api.todos.getAll, {});

const subdomain = useSubdomain();
const route = useRoute();

if (subdomain) {
  // Keep the subdomain in the query for local development
  if (import.meta.dev) {
    const query = route.query.subdomain
      ? `?subdomain=${route.query.subdomain}`
      : "";

    navigateTo(`/search${query}`);
  } else {
    navigateTo(`/search`);
  }
}
</script>

<template>
  <div class="container my-8">
    <Card>
      <CardHeader>
        <h1 class="text-4xl tracking-tight font-bold">Landing page</h1>
      </CardHeader>
      <CardContent> </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useSubdomain } from "@/composables/useSubdomain";

import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const { data: healthCheck } = await useConvexSSRQuery(api.healthCheck.get, {});

const { data: todos } = await useConvexSSRQuery(api.todos.getAll, {});

const subdomain = useSubdomain();
</script>

<template>
  <div class="container my-8">
    <Card>
      <CardHeader>
        <h1 class="text-4xl tracking-tight font-bold">
          IT Arena 2025 {{ subdomain }}
        </h1>
      </CardHeader>
      <CardContent>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground"> Health Check </span>
          <span class="text-sm text-muted-foreground">
            {{
              healthCheck === undefined
                ? "Checking..."
                : healthCheck === "OK"
                  ? "Connected"
                  : "Error"
            }}
            {{ healthCheck }}
          </span>
        </div>
        <div class="text-sm text-muted-foreground">
          {{ todos.length }}
          <ul>
            <li v-for="todo in todos" :key="todo._id">
              {{ todo.text }}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

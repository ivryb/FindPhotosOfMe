<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const { data: healthCheck } = await useConvexSSRQuery(api.healthCheck.get, {});

const { data: todos } = await useConvexSSRQuery(api.todos.getAll, {});
</script>

<template>
  <!-- <div
      class="absolute z-0 inset-0 bg-[url('/collage.jpg')] bg-cover blur-xs"
    />
    <div class="absolute z-10 inset-0 bg-black opacity-70" />
    <div
      class="absolute z-20 inset-0 bg-radial from-transparent via-background to-background"
    /> -->
  <!-- <div class="relative z-30 overflow-hidden">
    <pre class="font-mono text-center text-[2vw] sm:text-[1vw] text-primary">
      {{ TITLE_TEXT }}
    </pre>
  </div> -->
  <div class="container my-8">
    <Card>
      <CardHeader>
        <h1 class="text-2xl tracking-tight font-bold">IT Arena 2025</h1>
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

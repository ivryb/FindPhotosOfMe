<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexQuery } from "convex-vue";

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

const healthCheck = useConvexQuery(api.healthCheck.get, {});
</script>

<template>
  <div class="container mx-auto max-w-3xl px-4 py-2">
    <pre class="overflow-x-auto font-mono text-sm whitespace-pre-wrap">{{ TITLE_TEXT }}</pre>
    <div class="grid gap-6 mt-4">
      <section class="rounded-lg border p-4">
        <h2 class="mb-2 font-medium">API Status</h2>
        <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">
              {{
                healthCheck === undefined
                  ? "Checking..."
                  : healthCheck.data.value === "OK"
                    ? "Connected"
                    : "Error"
              }}
            </span>
        </div>
      </section>
    </div>
  </div>
</template>

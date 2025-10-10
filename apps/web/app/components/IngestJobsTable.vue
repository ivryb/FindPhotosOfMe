<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { computed } from "vue";
import { useConvexSSRQuery } from "@/composables/useConvexSSRQuery";
import { useConvexClient } from "convex-vue";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const props = defineProps<{ collectionId: Id<"collections"> }>();

const convex = useConvexClient();

const { data: jobs } = await useConvexSSRQuery(
  api.ingestJobs.listByCollection,
  {
    collectionId: props.collectionId,
  }
);

const rows = computed(() => jobs.value ?? []);

const pct = (processed?: number, total?: number) => {
  if (!processed || !total || total === 0) return 0;
  return Math.round((processed / total) * 100);
};

async function retry(jobId: Id<"ingestJobs">) {
  await convex.mutation(api.ingestJobs.retry, { id: jobId });
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="rows.length === 0" class="text-sm text-muted-foreground">
      No ingest jobs yet.
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="job in rows"
        :key="job._id"
        class="border rounded-md p-3 flex flex-col gap-2"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium truncate">{{ job.filename }}</div>
          <Badge
            :variant="
              job.status === 'failed'
                ? 'destructive'
                : job.status === 'completed'
                  ? 'outline'
                  : 'default'
            "
          >
            {{ job.status.toUpperCase() }}
          </Badge>
        </div>
        <div class="text-xs text-muted-foreground">
          <span v-if="job.startedAt"
            >Started: {{ new Date(job.startedAt).toLocaleString() }}</span
          >
          <span v-if="job.finishedAt">
            · Finished: {{ new Date(job.finishedAt).toLocaleString() }}</span
          >
        </div>
        <div v-if="job.status === 'failed'" class="flex justify-end">
          <Button size="sm" variant="outline" @click="retry(job._id)"
            >Retry</Button
          >
        </div>
        <div class="flex items-center justify-between text-sm">
          <div>
            {{ job.processedImages
            }}<template v-if="job.totalImages !== undefined">
              / {{ job.totalImages }}</template
            >
          </div>
          <div class="w-2/3">
            <Progress
              :model-value="pct(job.processedImages, job.totalImages)"
            />
          </div>
        </div>
        <div v-if="job.error" class="text-xs text-destructive">
          {{ job.error }}
        </div>
      </div>
    </div>
  </div>
</template>

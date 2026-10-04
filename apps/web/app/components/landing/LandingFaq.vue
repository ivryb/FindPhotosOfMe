<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FaqColumn } from "@/utils/landing";

// Two columns of question cards, each column with its own heading.
defineProps<{ columns: FaqColumn[] }>();
</script>

<template>
  <LandingSection id="questions" tone="grey">
    <h2 class="title">Questions</h2>
    <div class="faq">
      <div v-for="column in columns" :key="column.title" class="list">
        <h3>{{ column.title }}</h3>
        <Accordion type="multiple" class="grid gap-2.5">
          <AccordionItem v-for="item in column.items" :key="item.q" :value="item.q" class="group rounded-xl border-0 bg-background">
            <AccordionTrigger class="items-center rounded-xl py-[18px] pr-[18px] pl-[22px] text-[1.08rem] leading-snug font-bold hover:no-underline">
              {{ item.q }}
              <template #icon>
                <span class="grid size-[34px] shrink-0 place-items-center rounded-full bg-muted transition-[rotate,background-color,color] duration-200 group-data-[state=open]:rotate-45 group-data-[state=open]:bg-foreground group-data-[state=open]:text-background">
                  <Plus class="size-[18px]" :stroke-width="2.25" />
                </span>
              </template>
            </AccordionTrigger>
            <AccordionContent class="max-w-[62ch] px-[22px] pb-[22px] text-base text-muted-foreground">
              {{ item.a }}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  </LandingSection>
</template>

<style scoped>
.title { margin-bottom: clamp(32px, 4vw, 48px); }
.faq { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 40px clamp(20px, 3vw, 32px); }
.list > h3 { margin-bottom: 16px; }
@media (max-width: 860px) { .faq { grid-template-columns: 1fr; } }
</style>

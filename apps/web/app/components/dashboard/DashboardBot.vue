<script setup lang="ts">
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { useConvexMutation } from "convex-vue";
import { Send } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Gallery } from "@/utils/galleries";

// The Telegram bot tab: how to make a bot, then connecting it to this gallery with its welcome message.
const props = defineProps<{ gallery: Gallery }>();

const token = ref(props.gallery.telegramBotToken ?? "");
const welcome = ref(props.gallery.welcomeMessage ?? "");
const connected = computed(() => Boolean(props.gallery.telegramBotToken));

const { mutate: storeToken } = useConvexMutation(api.collections.storeTelegramBotToken);
const { mutate: update } = useConvexMutation(api.collections.update);
const saving = ref(false);
const saved = ref(false);
const error = ref<string>();
async function save() {
  saving.value = true;
  saved.value = false;
  error.value = undefined;
  try {
    const { _id: id, subdomain, title, description } = props.gallery;
    if (token.value.trim() !== props.gallery.telegramBotToken) await storeToken({ id, token: token.value.trim() });
    await update({ id, subdomain, title, description, welcomeMessage: welcome.value });
    saved.value = true;
  } catch (cause) {
    error.value = readableError(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <DashboardCard title="Telegram bot">
    <template #aside><DashboardPill :tone="connected ? 'ok' : 'idle'">{{ connected ? "Connected" : "Not connected" }}</DashboardPill></template>
    <div class="layout">
      <ol class="steps">
        <li><p><b>Create a bot</b>Open @BotFather in Telegram and send /newbot.</p></li>
        <li><p><b>Paste its token here</b>BotFather sends it after you name the bot.</p></li>
        <li><p><b>Share the bot link</b>People send it a selfie and get their photos in the chat.</p></li>
      </ol>
      <form class="grid gap-5" @submit.prevent="save" @input="saved = false">
        <div class="grid gap-2">
          <Label for="bot-token">Bot token</Label>
          <Input id="bot-token" v-model="token" required placeholder="123456:ABC-DEF1234ghIkl" autocomplete="off" spellcheck="false" />
        </div>
        <div class="grid gap-2">
          <Label for="bot-welcome">Welcome message</Label>
          <Textarea id="bot-welcome" v-model="welcome" rows="5" :placeholder="`Hi! Send me a selfie and I’ll find your photos from ${gallery.title}.`" />
          <p class="text-sm text-muted-foreground">The first message people see when they open the bot. Write {IMAGES_COUNT} to show how many photos there are.</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" :disabled="saving"><Send />{{ saving ? "Saving…" : connected ? "Save changes" : "Connect bot" }}</Button>
          <p v-if="saved" class="text-sm text-muted-foreground" role="status">Saved</p>
          <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        </div>
      </form>
    </div>
  </DashboardCard>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 24px clamp(24px, 4vw, 48px); }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
.steps { counter-reset: step; }
.steps li { display: grid; grid-template-columns: auto 1fr; gap: 14px; padding-block: 12px; border-top: 1px solid var(--border); color: var(--muted-foreground); counter-increment: step; }
.steps li::before { content: counter(step); font-size: 1.5rem; font-weight: 900; font-stretch: 125%; line-height: 1; color: var(--foreground); }
.steps b { display: block; color: var(--foreground); }
</style>

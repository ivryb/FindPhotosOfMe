<script setup lang="ts">
import { CameraIcon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const authClient = useAuthClient();
const session = authClient.useSession();

async function signOut() {
  await authClient.signOut();
  window.location.assign("/");
}
</script>
<template>
  <header
    class="fixed z-50 top-0 w-full h-16 pt-1 flex items-center border-b border-dashed backdrop-blur-[8px] bg-background/60"
  >
    <div class="container flex items-center justify-between">
      <NuxtLink to="/" class="inline-flex items-center gap-2">
        <CameraIcon class="size-7 text-primary" />
        <span class="text-xl font-semibold tracking-tight">
          FindPhotosOfMe.com
        </span>
      </NuxtLink>
      <div v-if="!session.isPending">
        <Button v-if="session.data?.session" variant="ghost" @click="signOut">Sign out</Button>
        <Button v-else as-child variant="ghost"><NuxtLink to="/sign-in">Sign in</NuxtLink></Button>
      </div>
    </div>
  </header>
  <div class="h-16"></div>
</template>

<script setup>
import { CameraIcon } from "lucide-vue-next";
</script>
<template>
  <header
    class="fixed z-50 top-0 w-full h-16 pt-1 flex items-center border-b border-dashed backdrop-blur-[8px] bg-background/60"
  >
    <div class="container">
      <NuxtLink to="/" class="inline-flex items-center gap-2">
        <CameraIcon class="size-7 text-primary" />
        <span class="text-xl font-semibold tracking-tight">
          FindPhotosOfMe.com
        </span>
      </NuxtLink>
    </div>
  </header>
  <div class="h-16"></div>
</template>

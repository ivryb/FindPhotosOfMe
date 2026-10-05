<script setup lang="ts">
import { Download } from "@lucide/vue";
import { encode } from "uqr";
import { Button } from "@/components/ui/button";

// A QR code for a gallery's link, to print on signs and slides.
const props = defineProps<{ link: string; name: string }>();

const BORDER = 2;
const code = computed(() => {
  const { data, size } = encode(props.link, { border: 0 });
  const path = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  return { path, size };
});

/** Saves the code as a large PNG with a white border, sharp enough for print. */
function download() {
  const { path, size } = code.value;
  const scale = Math.floor(2048 / (size + BORDER * 2));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (size + BORDER * 2) * scale;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.translate(BORDER, BORDER);
  context.fillStyle = "#151515";
  context.fill(new Path2D(path));
  const link = document.createElement("a");
  link.download = `${props.name} QR code.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
</script>

<template>
  <div class="qr-card">
    <svg :viewBox="`-1 -1 ${code.size + 2} ${code.size + 2}`" role="img" :aria-label="`QR code for ${link}`" shape-rendering="crispEdges">
      <path :d="code.path" fill="#151515" />
    </svg>
    <p>People scan this to open your gallery.</p>
    <Button variant="outline" size="sm" class="w-full" @click="download"><Download />Download</Button>
  </div>
</template>

<style scoped>
.qr-card { width: 196px; padding: 14px 14px 16px; background: var(--background); border-radius: 14px; text-align: center; }
.qr-card > svg { width: 100%; }
p { margin: 8px 0 10px; color: var(--muted-foreground); font-size: .85rem; line-height: 1.35; }
</style>

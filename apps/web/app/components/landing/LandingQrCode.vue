<script setup lang="ts">
// A decorative QR code: the three corner markers and a fixed pseudo-random pattern. It doesn't scan.
const SIZE = 25;
const CORNERS = [[0, 0], [SIZE - 7, 0], [0, SIZE - 7]] as const;

const path = (() => {
  let seed = 11;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const nearCorner = (x: number, y: number) => CORNERS.some(([cx, cy]) => x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7);
  let modules = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) if (!nearCorner(x, y) && random() < 0.5) modules += `M${x} ${y}h1v1h-1z`;
  }
  const markers = CORNERS.map(([x, y]) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`).join("");
  return modules + markers;
})();
</script>

<template>
  <svg class="qr" viewBox="-2 -2 29 29" aria-hidden="true"><path :d="path" fill="#151515" fill-rule="evenodd" /></svg>
</template>

<style scoped>
.qr { display: block; width: 100%; background: #fff; border-radius: 4px; }
</style>

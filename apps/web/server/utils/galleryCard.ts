/// <reference path="../types/wasm.d.ts" />
import init, { Renderer } from "@takumi-rs/wasm";
import { container, image, text } from "@takumi-rs/helpers";
import wasm from "@takumi-rs/wasm/takumi_wasm_bg.wasm?module";

/** What a gallery's link preview shows. `photos` are image bytes keyed by their R2 key; at least one. */
export type GalleryCard = { title: string; count: number; photos: { key: string; data: ArrayBuffer }[] };

// The layout is the "Gallery page" option in design/og: ink like the gallery page, its name and photo count beside the
// yellow selfie search button, and its first photos as a staggered grid running off the right edge.
const SIZE = { width: 1200, height: 630 };
const INK = "#151515";
const YELLOW = "#ffd21f";
// Archivo has no Cyrillic, so Cyrillic names fall back to Roboto Flex, which can be set just as wide.
const FONTS = "Archivo, Roboto Flex";
// The name's room: the copy column's width, and its height between the logo and the photo count.
const TITLE = { width: 556, height: 290 };
// Long names step down through these sizes until they fit; anything longer still is cut short with an ellipsis.
const TITLE_SIZES = [84, 76, 68, 60, 54, 48];
const TILES = 5;
// The fonts have no emoji, which would show as empty boxes.
const EMOJI = /\p{Extended_Pictographic}|\u200d|\ufe0f/gu;
const CAMERA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>`;

/** A gallery's link preview as a 1200×630 JPEG. */
export async function renderGalleryCard(card: GalleryCard) {
  const { renderer, lockup } = await setUp();
  const title = card.title.replace(EMOJI, "").trim();
  const size = await fitTitle(renderer, title);
  // Galleries with fewer previews than tiles repeat them
  const tiles = Array.from({ length: TILES }, (_, i) => card.photos[i % card.photos.length]!.key);
  return renderer.render(layout(title, size, card.count, tiles), {
    ...SIZE,
    format: "jpeg",
    quality: 85,
    images: [
      { src: "lockup", data: lockup },
      { src: "camera", data: new TextEncoder().encode(CAMERA) },
      // Photos are decoded fresh each time; the finished image is what gets cached
      ...card.photos.map(({ key, data }) => ({ src: key, data, cache: "none" as const })),
    ],
  });
}

// One renderer per Worker isolate, made on first use
let ready: Promise<{ renderer: Renderer; lockup: Uint8Array }> | undefined;
function setUp() {
  return (ready ??= (async () => {
    await init({ module_or_path: wasm });
    const assets = useStorage("assets:server");
    const file = async (name: string) => {
      const data = await assets.getItemRaw<Uint8Array>(`og:${name}`);
      if (!data) throw new Error(`Missing server asset og/${name}`);
      return data;
    };
    const renderer = new Renderer();
    await renderer.registerFont({ name: "Archivo", data: await file("archivo-latin.woff2") });
    await renderer.registerFont({ name: "Archivo", data: await file("archivo-latin-ext.woff2") });
    await renderer.registerFont({ name: "Roboto Flex", data: await file("robotoflex-cyrillic.woff2") });
    return { renderer, lockup: await file("lockup-white.svg") };
  })());
}

// The largest size at which the name fits its room without breaking a word
async function fitTitle(renderer: Renderer, title: string) {
  for (const size of TITLE_SIZES) {
    const box = await renderer.measure(container({ style: { display: "flex", width: TITLE.width, fontFamily: FONTS }, children: [name(title, size)] }));
    const lines = box.children[0]!;
    if (lines.height <= TITLE.height && lines.runs.every((run) => run.x + run.width <= TITLE.width + 0.5)) return size;
  }
  return TITLE_SIZES.at(-1)!;
}

function name(title: string, size: number) {
  return text(title, { fontSize: size, fontWeight: 900, fontStretch: "118%", letterSpacing: "-0.035em", lineHeight: 0.98, textWrap: "balance" });
}

function layout(title: string, size: number, count: number, tiles: string[]) {
  const column = (srcs: string[], top: number) => container({
    style: { display: "flex", flexDirection: "column", gap: 12, marginTop: top },
    children: srcs.map((src) => image({ src, style: { width: 270, height: 330, borderRadius: 14, objectFit: "cover" } })),
  });
  // Even the smallest size can run out of room, so the name is clamped to the lines that fit
  const clamped = name(title, size);
  Object.assign(clamped.style!, { lineClamp: Math.floor(TITLE.height / (size * 0.98)), textOverflow: "ellipsis", overflowWrap: "anywhere" });

  return container({
    style: { ...SIZE, display: "flex", backgroundColor: INK, color: "#fff", fontFamily: FONTS },
    children: [
      image({ src: "lockup", style: { position: "absolute", top: 56, left: 64, width: 259, height: 36 } }),
      container({
        style: { display: "flex", flexDirection: "column", justifyContent: "flex-end", width: 620, padding: "0 0 60px 64px" },
        children: [
          clamped,
          text(`${count.toLocaleString("en-US")} ${count === 1 ? "photo" : "photos"}`, { margin: "18px 0 36px", fontSize: 28, fontWeight: 800, fontStretch: "112%" }),
          container({
            style: { display: "flex", alignItems: "center", gap: 14, alignSelf: "flex-start", height: 68, padding: "0 28px 0 24px", borderRadius: 16, backgroundColor: YELLOW, color: INK },
            children: [
              image({ src: "camera", style: { width: 32, height: 32 } }),
              text("Find your photos with a selfie", { fontSize: 26, fontWeight: 800, fontStretch: "108%" }),
            ],
          }),
        ],
      }),
      container({
        style: { position: "absolute", top: 0, left: 664, display: "flex", gap: 12 },
        children: [column(tiles.slice(0, 3), -200), column(tiles.slice(3), -30)],
      }),
    ],
  });
}

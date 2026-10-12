import { expect, test } from "bun:test";
import { BlobReader, BlobWriter, TextReader, ZipWriter, configure } from "@zip.js/zip.js";
import { readSources } from "../app/utils/photoSources";

configure({ useWebWorkers: false });

async function zip(name: string, files: Record<string, string>) {
  const writer = new ZipWriter(new BlobWriter("application/zip"));
  for (const [path, content] of Object.entries(files)) await writer.add(path, new TextReader(content));
  return new File([await writer.close()], name);
}

test("a ZIP's photos get safe names that are unique and the same each time it's read", async () => {
  const day = await zip("Day 1.zip", {
    "morning/IMG_1.jpg": "a",
    "evening/IMG_1.jpg": "b",
    "__MACOSX/morning/._IMG_1.jpg": "resource fork",
    "evening/._IMG_2.jpg": "resource fork",
    "notes.txt": "not a photo",
    "Fête 1.PNG": "c",
  });
  const read = async () => {
    const [source] = await readSources([day]);
    return source!;
  };
  const first = await read();
  expect(first.photos.map((photo) => photo.name)).toEqual(["IMG_1.jpg", "IMG_1-1.jpg", "F_te_1.png"]);
  expect(await (await first.photos[1]!.read()).text()).toBe("b");
  for (const photo of first.photos) expect(photo.size).toBe((await photo.read()).size);
  expect((await read()).photos.map((photo) => photo.name)).toEqual(first.photos.map((photo) => photo.name));
  expect(first).toMatchObject({ name: "Day 1.zip", size: day.size, tooLarge: 0 });
});

test("photos and videos chosen alongside ZIPs are one more upload, and other files are left out", async () => {
  const sources = await readSources([
    await zip("day.zip", { "a.jpg": "a", "toast.mp4": "v" }),
    new File(["x"], "stage.jpg"),
    new File(["y"], "stage.jpeg"),
    new File(["z"], "clip.mov"),
    new File(["n"], "notes.txt"),
  ]);
  expect(sources.map((source) => [source.name, source.photos.length])).toEqual([["day.zip", 2], ["2 photos and 1 video", 3]]);
  for (const source of sources) for (const photo of source.photos) expect(photo.size).toBe((await photo.read()).size);
});

test("photos chosen together keep the same order however they were picked", async () => {
  const picked = ["b.jpg", "a.jpg", "c.png"].map((name) => new File([name], name));
  const names = async (files: File[]) => (await readSources(files))[0]!.photos.map((photo) => photo.name);
  expect(await names(picked)).toEqual(await names(picked.toReversed()));
});

test("videos may be up to 500 MB, photos up to 50 MB", async () => {
  const sized = (name: string, size: number) => Object.defineProperty(new File(["x"], name), "size", { value: size });
  const [source] = await readSources([sized("toast.MOV", 400 * 1024 ** 2), sized("speech.mp4", 600 * 1024 ** 2), sized("stage.jpg", 60 * 1024 ** 2)]);
  expect(source).toMatchObject({ name: "1 photo and 2 videos", tooLarge: 2 });
  expect(source!.photos.map((photo) => photo.name)).toEqual(["toast.mov"]);
});

test("photos go before videos, so a camera roll's videos don't split its photos into small batches", async () => {
  const roll = ["IMG_1.jpg", "IMG_2.mov", "IMG_3.jpg", "IMG_4.mp4", "IMG_5.jpg"];
  const [loose] = await readSources(roll.map((name) => new File([name], name)));
  expect(loose!.photos.map((photo) => photo.name)).toEqual(["IMG_1.jpg", "IMG_3.jpg", "IMG_5.jpg", "IMG_2.mov", "IMG_4.mp4"]);
  const [zipped] = await readSources([await zip("roll.zip", Object.fromEntries(roll.map((name) => [name, name])))]);
  expect(zipped!.photos.map((photo) => photo.name)).toEqual(["IMG_1.jpg", "IMG_3.jpg", "IMG_5.jpg", "IMG_2.mov", "IMG_4.mp4"]);
});

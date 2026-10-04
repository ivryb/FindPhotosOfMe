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
  expect((await read()).photos.map((photo) => photo.name)).toEqual(first.photos.map((photo) => photo.name));
  expect(first).toMatchObject({ name: "Day 1.zip", size: day.size, tooLarge: 0 });
});

test("photos chosen alongside ZIPs are one more upload, and other files are left out", async () => {
  const sources = await readSources([
    await zip("day.zip", { "a.jpg": "a" }),
    new File(["x"], "stage.jpg"),
    new File(["y"], "stage.jpeg"),
    new File(["z"], "clip.mov"),
  ]);
  expect(sources.map((source) => [source.name, source.photos.length])).toEqual([["day.zip", 1], ["2 photos", 2]]);
});

test("photos chosen together keep the same order however they were picked", async () => {
  const picked = ["b.jpg", "a.jpg", "c.png"].map((name) => new File([name], name));
  const names = async (files: File[]) => (await readSources(files))[0]!.photos.map((photo) => photo.name);
  expect(await names(picked)).toEqual(await names(picked.toReversed()));
});

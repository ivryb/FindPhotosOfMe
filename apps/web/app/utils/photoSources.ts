import { MAX_PHOTO_BYTES, photoType } from "@FindPhotosOfMe/backend/convex/photoKeys";
import type { Entry, FileEntry } from "@zip.js/zip.js";

export type Photo = { name: string; size: number; read: () => Promise<Blob> };

/**
 * What one upload sends: the photos of a ZIP, or photos chosen together. Photos keep the same names and order
 * each time the same files are read, so an interrupted upload continues where it stopped.
 */
export type Source = { name: string; size: number; photos: Photo[]; tooLarge: number; close: () => Promise<void> };

const IMAGE = /\.(jpe?g|png)$/i;
const isZip = (file: File) => /\.zip$/i.test(file.name);

/** Each ZIP is one upload, and photos chosen alongside them are one more. Other files are left out. */
export async function readSources(files: File[]): Promise<Source[]> {
  const sources = await Promise.all(files.filter(isZip).map(readZip));
  const loose = files.filter((file) => !isZip(file) && isPhoto(file.name));
  if (loose.length) sources.push(readLoose(loose));
  return sources.filter((source) => source.photos.length || source.tooLarge);
}

/** Reads only the ZIP's list of files up front; each photo is unpacked when it's sent, so ZIPs of any size fit in memory. */
async function readZip(file: File): Promise<Source> {
  const { ZipReader, BlobReader, BlobWriter } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(file));
  const entries = (await reader.getEntries()).filter((entry: Entry): entry is FileEntry =>
    !entry.directory && !entry.filename.startsWith("__MACOSX/") && isPhoto(entry.filename));
  const fits = entries.filter((entry) => entry.uncompressedSize <= MAX_PHOTO_BYTES);
  const names = new Set<string>();
  return {
    name: file.name,
    size: file.size,
    tooLarge: entries.length - fits.length,
    photos: fits.map((entry) => {
      const name = uniqueName(entry.filename, names);
      return { name, size: entry.uncompressedSize, read: () => entry.getData(new BlobWriter(photoType(name))) };
    }),
    close: () => reader.close(),
  };
}

function readLoose(chosen: File[]): Source {
  // The browser lists chosen files in whatever order they were picked; sorting keeps a resumed upload's photos in place.
  const files = chosen.toSorted((a, b) => a.name.localeCompare(b.name) || a.size - b.size);
  const fits = files.filter((file) => file.size <= MAX_PHOTO_BYTES);
  const names = new Set<string>();
  return {
    name: files.length === 1 ? files[0]!.name : `${files.length} photos`,
    size: files.reduce((total, file) => total + file.size, 0),
    tooLarge: files.length - fits.length,
    photos: fits.map((file) => ({ name: uniqueName(file.name, names), size: file.size, read: async () => file })),
    close: async () => {},
  };
}

// macOS adds "._" files beside photos; they share the photo's name but aren't photos.
const isPhoto = (path: string) => IMAGE.test(path) && !baseName(path).startsWith("._");
const baseName = (path: string) => path.split("/").pop() ?? path;

/** A safe file name for R2, unique within the upload: photos with the same name in different folders get -1, -2. */
function uniqueName(path: string, used: Set<string>) {
  const clean = baseName(path).replace(/[^A-Za-z0-9._-]/g, "_");
  const dot = clean.lastIndexOf(".");
  const stem = clean.slice(0, dot).slice(0, 180) || "photo";
  const extension = clean.slice(dot).toLowerCase();
  let name = stem + extension;
  for (let copy = 1; used.has(name); copy++) name = `${stem}-${copy}${extension}`;
  used.add(name);
  return name;
}

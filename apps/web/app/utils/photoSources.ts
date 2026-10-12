import { isVideo, maxBytes, mediaType } from "@FindPhotosOfMe/backend/convex/photoKeys";
import { count } from "./pricing";
import type { Entry, FileEntry } from "@zip.js/zip.js";

export type Photo = { name: string; size: number; read: () => Promise<Blob> };

/**
 * What one upload sends: the photos and videos of a ZIP, or those chosen together. They keep the same names and order
 * each time the same files are read, so an interrupted upload continues where it stopped.
 */
export type Source = { name: string; size: number; photos: Photo[]; tooLarge: number; close: () => Promise<void> };

/** What file pickers offer: ZIPs, and the photos and videos uploads take. */
export const UPLOAD_TYPES = ".zip,application/zip,image/jpeg,image/png,video/mp4,video/quicktime,video/webm,.m4v";

const IMAGE = /\.(jpe?g|png)$/i;
const isZip = (file: File) => /\.zip$/i.test(file.name);

/** Each ZIP is one upload, and photos and videos chosen alongside them are one more. Other files are left out. */
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
    !entry.directory && !entry.filename.startsWith("__MACOSX/") && isPhoto(entry.filename))
    .toSorted((a, b) => videosLast(a.filename, b.filename));
  const fits = entries.filter((entry) => entry.uncompressedSize <= maxBytes(entry.filename));
  const names = new Set<string>();
  return {
    name: file.name,
    size: file.size,
    tooLarge: entries.length - fits.length,
    photos: fits.map((entry) => {
      const name = uniqueName(entry.filename, names);
      return { name, size: entry.uncompressedSize, read: () => entry.getData(new BlobWriter(mediaType(name))) };
    }),
    close: () => reader.close(),
  };
}

function readLoose(chosen: File[]): Source {
  // The browser lists chosen files in whatever order they were picked; sorting keeps a resumed upload's photos in place.
  const files = chosen.toSorted((a, b) => videosLast(a.name, b.name) || a.name.localeCompare(b.name) || a.size - b.size);
  const fits = files.filter((file) => file.size <= maxBytes(file.name));
  const names = new Set<string>();
  const videos = files.filter((file) => isVideo(file.name)).length;
  return {
    name: files.length === 1 ? files[0]!.name : [plural(files.length - videos, "photo"), plural(videos, "video")].filter(Boolean).join(" and "),
    size: files.reduce((total, file) => total + file.size, 0),
    tooLarge: files.length - fits.length,
    photos: fits.map((file) => ({ name: uniqueName(file.name, names), size: file.size, read: async () => file })),
    close: async () => {},
  };
}

/** What an upload's files are called, as its name tells: videos when it holds only videos, otherwise photos. */
export const uploadWord = (name: string) => (isVideo(name) || /^\d+ videos?$/.test(name) ? "video" : "photo");

/** A count of the files in some uploads, such as "3 videos" for uploads of only videos, otherwise in photos. */
export function countFiles(n: number, uploads: { name: string }[]) {
  const word = uploads.every((upload) => uploadWord(upload.name) === "video") ? "video" : "photo";
  return `${count.format(n)} ${word}${n === 1 ? "" : "s"}`;
}

// Each video is a batch of its own (nextBatch), so videos go after the photos instead of cutting their batches short.
const videosLast = (a: string, b: string) => Number(isVideo(a)) - Number(isVideo(b));

// macOS adds "._" files beside photos; they share the photo's name but aren't photos.
const isPhoto = (path: string) => (IMAGE.test(path) || isVideo(path)) && !baseName(path).startsWith("._");
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : "");
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

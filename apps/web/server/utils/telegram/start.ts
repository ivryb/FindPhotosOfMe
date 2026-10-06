import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

export function welcomeText(collection: Doc<"collections">) {
  const message = collection.welcomeMessage || `Welcome to ${collection.title}!

Send a selfie to find your photos. Your selfie will not be added to the gallery.

${collection.crowdsource ? "Choose Upload photos to contribute, or Browse gallery to see everyone’s photos." : "Choose Browse gallery to see the photos."}`;
  return message.replaceAll("{IMAGES_COUNT}", String(collection.imagesCount)).trim();
}

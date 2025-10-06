import type { Context } from "grammy";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

const getText = (collection: Doc<"collections">) => {
  return `
Hi! This bot will help you find photos of you from the IT Arena!\n\n
There are ${collection.imagesCount} photos in the collection.\n\n
Just send here a photo of yourself, and we will use machine learning magic to filter out photos where you are present.\n\n
P.S. Your reference photo will not be stored or shared with anyone. Pinky promise!
`.trim();
};

export const handleStart = (collection: Doc<"collections">) => {
  return async (ctx: Context) => {
    await ctx.reply(getText(collection));
  };
};

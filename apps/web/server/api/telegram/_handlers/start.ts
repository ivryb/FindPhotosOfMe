import type { Context } from "grammy";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

const getText = (collection: Doc<"collections">) => {
  return `
Hi! This bot will help you *find photos of yourself from the IT Arena!* 🙌🏻

There are currently *${collection.imagesCount} photos* in the collection.  

Just *send a photo of yourself here* 📸 and we will use some machine learning magic 💫 to filter out the photos where you are present.  

P.S. Your reference photo will not be stored or shared with anyone. _Pinky promise!_  
`.trim();
};

export const handleStart = (collection: Doc<"collections">) => {
  return async (ctx: Context) => {
    await ctx.reply(getText(collection), {
      parse_mode: "MarkdownV2",
    });
  };
};

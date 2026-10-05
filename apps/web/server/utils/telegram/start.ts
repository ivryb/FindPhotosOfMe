import type { Context } from "grammy";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

const getDefaultMessage = (collection: Doc<"collections">) =>
  `
Hi\! This bot will help you *find photos of yourself from the ${collection.title}\!* 🙌🏻

There are currently *{IMAGES_COUNT} photos* in the collection\.  

Just *send a photo of yourself here* 📸 and we will use some machine learning magic 💫 to filter out the photos where you are present\.  

P\.S\. We respect your privacy\. Your reference photo will not be stored or shared with anyone\. _Pinky promise\!_
`.trim();

const getText = (collection: Doc<"collections">) => {
  const message = collection.welcomeMessage || getDefaultMessage(collection);

  // Replace {IMAGES_COUNT} template with actual count
  return message
    .replace(/{IMAGES_COUNT}/g, String(collection.imagesCount))
    .trim();
};

export const handleStart = (collection: Doc<"collections">) => {
  return async (ctx: Context) => {
    // The bot can be configured before publication; its welcome content must stay private too.
    if (collection.published === false) {
      await ctx.reply("This gallery is private. Please ask its owner to publish it.");
      return;
    }
    await ctx.reply(getText(collection), {
      parse_mode: "MarkdownV2",
    });
  };
};

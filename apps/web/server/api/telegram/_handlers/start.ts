import type { Context } from "grammy";

export const handleStart = async (ctx: Context) => {
  await ctx.reply(
    "Hi! Send me a clear photo of yourself to search this collection."
  );
};

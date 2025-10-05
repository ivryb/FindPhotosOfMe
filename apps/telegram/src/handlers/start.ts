import { CommandContext } from "grammy";
import { BotContext } from "../types.js";

export async function handleStart(ctx: CommandContext<BotContext>) {
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "there";
  
  console.log(`[Bot] /start command from chat ${chatId}, user: ${username}`);

  const welcomeMessage = `👋 Welcome, ${username}!

I'm here to help you find photos of yourself in our collection.

📸 **How it works:**
1. Send me a clear photo of yourself
2. I'll search through the collection
3. You'll receive all photos where you appear

🔍 Ready to start? Just send me a photo!`;

  await ctx.reply(welcomeMessage);
}

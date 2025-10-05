import { Bot } from "grammy";
import { BotContext } from "./types.js";
import { handleStart } from "./handlers/start.js";
import { handlePhoto } from "./handlers/photo.js";
import { getCollectionBySubdomain } from "./convex-client.js";

/**
 * Create a bot instance for a specific collection
 */
export function createBot(botToken: string, collectionId: string, subdomain: string) {
  console.log(`[Bot] Creating bot for collection ${collectionId} (${subdomain})`);

  const bot = new Bot<BotContext>(botToken);

  // Set collection context
  bot.use(async (ctx, next) => {
    ctx.collectionId = collectionId;
    ctx.collectionSubdomain = subdomain;
    await next();
  });

  // Command handlers
  bot.command("start", handleStart);

  // Photo handler
  bot.on("message:photo", handlePhoto);

  // Error handler
  bot.catch((err) => {
    console.error("[Bot] Error:", err);
  });

  console.log(`[Bot] Bot created for collection ${subdomain}`);

  return bot;
}

/**
 * Get bot instance by collection subdomain
 * This is used by the webhook handler
 */
export async function getBotForCollection(subdomain: string) {
  console.log(`[Bot] Getting bot for collection ${subdomain}`);

  const collection = await getCollectionBySubdomain(subdomain);

  if (!collection) {
    throw new Error(`Collection not found: ${subdomain}`);
  }

  if (!collection.telegramBotToken) {
    throw new Error(`Bot token not set for collection: ${subdomain}`);
  }

  return createBot(collection.telegramBotToken, collection._id, collection.subdomain);
}

/**
 * Handle webhook update for a bot
 */
export async function handleUpdate(bot: Bot<BotContext>, update: any) {
  try {
    await bot.handleUpdate(update);
  } catch (error) {
    console.error("[Bot] Error handling update:", error);
    throw error;
  }
}

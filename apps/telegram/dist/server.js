import { Hono } from "hono";
import { Bot, GrammyError, HttpError, webhookCallback } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { handleStart } from "./src/handlers/start.ts";
import { createOnPhotoHandler } from "./src/handlers/onPhoto.ts";
import { log } from "./src/utils/log.ts";
const app = new Hono();
const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
    throw new Error("CONVEX_URL is required");
}
const httpClient = new ConvexHttpClient(convexUrl);
app.post("/api/telegram/:collectionId", async (c) => {
    const collectionId = c.req.param("collectionId");
    if (!collectionId) {
        return c.json({ ok: false, error: "Missing collectionId" }, 400);
    }
    const collection = await httpClient.query("collections:get", {
        id: collectionId,
    });
    if (!collection || !collection.telegramBotToken) {
        return c.json({ ok: false, error: "Collection/token not found" }, 404);
    }
    const bot = new Bot(collection.telegramBotToken);
    bot.command("start", handleStart);
    bot.on(":photo", createOnPhotoHandler(convexUrl, collectionId, collection.telegramBotToken));
    bot.catch((err) => {
        const ctx = err.ctx;
        log(`Bot error while handling update ${ctx.update.update_id}`);
        const e = err.error;
        if (e instanceof GrammyError) {
            log("Error in request", { description: e.description });
        }
        else if (e instanceof HttpError) {
            log("Could not contact Telegram", { error: String(e) });
        }
        else {
            log("Unknown error", { error: String(e) });
        }
    });
    const handler = webhookCallback(bot, "std/http");
    const res = await handler(c.req.raw);
    return new Response(res.body, res);
});
export default app;
//# sourceMappingURL=server.js.map
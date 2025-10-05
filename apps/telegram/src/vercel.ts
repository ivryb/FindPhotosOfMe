/**
 * Vercel serverless function entry point
 * This file exports the handler for Vercel's serverless functions
 */
import { getBotForCollection, handleUpdate } from "./bot.js";
import { config } from "./config.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Vercel] ${req.method} ${req.url}`);

  // Health check endpoint
  if (req.url === "/health" || req.url === "/") {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  // Webhook endpoint: /webhook/:subdomain
  const webhookMatch = req.url?.match(/^\/webhook\/([^\/]+)$/);

  if (webhookMatch && req.method === "POST") {
    const subdomain = webhookMatch[1];
    console.log(`[Vercel] Webhook request for collection: ${subdomain}`);

    try {
      // Get bot instance for this collection
      const bot = await getBotForCollection(subdomain);

      // Handle the webhook update
      await handleUpdate(bot, req.body);
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Vercel] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
    return;
  }

  // 404 for other routes
  res.status(404).json({ error: "Not found" });
}

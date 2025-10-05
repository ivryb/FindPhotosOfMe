import { createServer } from "http";
import { getBotForCollection, handleUpdate } from "./bot.js";
import { config } from "./config.js";

const PORT = process.env.PORT || 3002;

/**
 * Simple HTTP server to handle Telegram webhooks
 * This is designed to work with serverless platforms like Vercel
 */
const server = createServer(async (req, res) => {
  console.log(`[Server] ${req.method} ${req.url}`);

  // Health check endpoint
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }

  // Webhook endpoint: /webhook/:subdomain
  const webhookMatch = req.url?.match(/^\/webhook\/([^\/]+)$/);
  
  if (webhookMatch && req.method === "POST") {
    const subdomain = webhookMatch[1];
    console.log(`[Server] Webhook request for collection: ${subdomain}`);

    try {
      // Get bot instance for this collection
      const bot = await getBotForCollection(subdomain);

      // Parse request body
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          console.log(`[Server] Webhook body received, length: ${body.length}`);
          
          const update = JSON.parse(body);
          await handleUpdate(bot, update);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          console.error("[Server] Error handling webhook:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    } catch (error) {
      console.error("[Server] Error getting bot:", error);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bot not found or not configured" }));
    }
    return;
  }

  // 404 for other routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[Server] Telegram bot webhook server running on port ${PORT}`);
  console.log(`[Server] Webhook endpoint: ${config.webhookUrl}/webhook/:subdomain`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] Server closed");
    process.exit(0);
  });
});

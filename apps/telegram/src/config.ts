import dotenv from "dotenv";

dotenv.config();

export const config = {
  convexUrl: process.env.CONVEX_URL || "",
  webhookUrl: process.env.WEBHOOK_URL || "",
  nodeEnv: process.env.NODE_ENV || "development",
};

if (!config.convexUrl) {
  throw new Error("CONVEX_URL environment variable is required");
}

if (!config.webhookUrl) {
  console.warn("WEBHOOK_URL not set - webhook setup will not work");
}

console.log(`[Config] Convex URL: ${config.convexUrl}`);
console.log(`[Config] Webhook URL: ${config.webhookUrl}`);
console.log(`[Config] Node ENV: ${config.nodeEnv}`);

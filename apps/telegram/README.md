# Telegram Bot (grammY)

Serverless Telegram bot using grammY, deployed on Vercel via webhooks.

Environment variables:

- TELEGRAM_WEBHOOK_BASE_URL: Base URL of this deployment, e.g., https://your-vercel-app.vercel.app
- CONVEX_URL: Convex deployment URL
- API_URL: Python service URL to start searches
- R2_PROXY_BASE_URL: Web app that serves images

Webhook URL format:

- ${TELEGRAM_WEBHOOK_BASE_URL}/api/telegram/<collectionId>

Flow:

- /start → prompt for a face photo
- Photo received → create Convex search request (with telegramChatId), upload photo to Python, reply when done
- Results are delivered by Convex internal action `telegram.sendResults` (triggered separately)

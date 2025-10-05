# Telegram Bot

Telegram bot for FindPhotosOfMe using the Grammy framework.

## Overview

This bot allows users to search for photos of themselves in a collection by sending a photo to the bot. The bot is connected to a specific collection and uses webhooks for serverless deployment.

## Features

- `/start` command - Welcome message and instructions
- Photo upload - Automatically triggers photo search
- Media groups - Results are sent as media groups (up to 10 photos per group)
- Webhook-based - Works with serverless platforms like Vercel

## Architecture

Each collection can have its own Telegram bot configured by setting the `telegramBotToken` in the collection settings. When a token is set:

1. Convex automatically sets the webhook URL via Telegram Bot API
2. Telegram sends updates to: `{WEBHOOK_URL}/webhook/{collectionSubdomain}`
3. Bot processes the update and interacts with Convex and Python services

## Setup

### 1. Create a Telegram Bot

1. Talk to [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` command and follow instructions
3. Save the bot token

### 2. Configure Environment

Create a `.env` file:

```bash
CONVEX_URL=https://your-deployment.convex.cloud
WEBHOOK_URL=https://your-bot.vercel.app
```

### 3. Set Bot Token in Collection

In your admin panel, add the Telegram bot token to the collection settings. The webhook will be automatically configured.

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Deployment

### Vercel

1. Push to GitHub
2. Import project to Vercel
3. Set environment variables:
   - `CONVEX_URL`
   - `WEBHOOK_URL` (your Vercel deployment URL)
4. Deploy

The `vercel.json` configuration handles routing for webhooks.

## Bot Flow

1. **User sends /start**
   - Bot sends welcome message
   - Prompts user to send a photo

2. **User sends photo**
   - Bot acknowledges and creates search request in Convex
   - Photo is downloaded and sent to Python service
   - Bot subscribes to search request updates

3. **Search completes**
   - Bot receives notification via Convex subscription
   - Results are sent as media groups (max 10 per group)
   - User can send another photo to search again

## Technical Details

- **Framework**: Grammy (Telegram Bot framework)
- **Runtime**: Node.js with TypeScript
- **Deployment**: Vercel (serverless functions)
- **Database**: Convex (real-time subscriptions)
- **Storage**: Cloudflare R2 (via proxy)

## Webhook URL Structure

```
{WEBHOOK_URL}/webhook/{collectionSubdomain}
```

Each collection has a unique webhook URL based on its subdomain.

## Logging

All actions are logged with timestamps for debugging:
- `[Server]` - HTTP server logs
- `[Bot]` - Bot action logs
- `[Convex]` - Convex client logs

## Limitations

- Media groups are limited to 10 photos each (Telegram restriction)
- Photos must be under 10MB (Telegram restriction)
- Bot token must be kept secret

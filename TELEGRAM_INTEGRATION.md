# Telegram Bot Integration

This document provides an overview of the Telegram bot integration for FindPhotosOfMe.

## Overview

The Telegram bot allows users to search for photos of themselves in a collection by simply sending a photo to the bot. Each collection can have its own dedicated Telegram bot.

## Architecture

```
User -> Telegram -> Webhook -> Bot App -> Convex <-> Python Service
                                    |
                                    v
                                 R2 Storage
```

### Components

1. **Telegram Bot App** (`apps/telegram/`)
   - Node.js application using Grammy framework
   - Handles webhook requests from Telegram
   - Manages bot instances per collection
   - Deployed on Vercel as serverless functions

2. **Convex Backend** (`packages/backend/convex/telegram.ts`)
   - Stores bot configuration (token, webhook URL)
   - Manages search requests with Telegram chat ID
   - Triggers webhook setup when bot token is configured

3. **Database Schema Updates**
   - `collections.telegramBotToken` - Bot API token for the collection
   - `searchRequests.telegramChatId` - Telegram chat ID for notifications
   - `searchRequests.telegramMessageId` - Message ID for status updates

## User Flow

1. **Bot Setup (Admin)**
   - Admin creates a bot via [@BotFather](https://t.me/botfather)
   - Admin sets bot token in collection settings
   - Convex automatically configures webhook

2. **User Interaction**
   ```
   User: /start
   Bot: Welcome message + instructions
   
   User: [sends photo]
   Bot: "🔍 Search started! Analyzing your photo..."
   
   [Python service processes photo]
   
   Bot: "✅ Found 5 photos with you!"
   Bot: [Sends photos as media groups]
   ```

3. **Search Process**
   - Bot downloads photo from Telegram
   - Creates search request in Convex with chat ID
   - Sends photo to Python service (TODO: implement)
   - Subscribes to search request updates via Convex
   - Sends results when search completes

## Technical Details

### Webhook Configuration

Each collection has a unique webhook URL:
```
{WEBHOOK_URL}/webhook/{collectionSubdomain}
```

When a bot token is set, Convex automatically calls:
```
https://api.telegram.org/bot{BOT_TOKEN}/setWebhook
```

### Media Groups

Results are sent using Telegram's media group feature:
- Maximum 10 photos per group
- Batched automatically if more than 10 results
- 1-second delay between batches to avoid rate limits

### Bot Context

Each bot instance has collection context:
```typescript
{
  collectionId: string,
  collectionSubdomain: string
}
```

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Convex deployment
- Telegram bot token (from @BotFather)

### Local Setup

1. **Create environment file**
   ```bash
   cd apps/telegram
   cp .env.example .env
   ```

2. **Configure environment variables**
   ```
   CONVEX_URL=https://your-deployment.convex.cloud
   WEBHOOK_URL=https://your-ngrok-url.ngrok.io  # or localhost for testing
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Run the bot**
   ```bash
   pnpm dev
   ```

5. **Set up tunnel (for webhook testing)**
   ```bash
   ngrok http 3002
   ```

### Testing Without Webhooks

For quick testing, you can temporarily use long polling:
```typescript
// In bot.ts, replace webhook handler with:
bot.start();
```

This is only for local development - production must use webhooks.

## Deployment

See [DEPLOYMENT.md](apps/telegram/DEPLOYMENT.md) for detailed deployment instructions.

Quick start:
1. Deploy to Vercel: `vercel`
2. Set environment variables in Vercel
3. Add bot token in admin panel
4. Webhook is automatically configured

## File Structure

```
apps/telegram/
├── src/
│   ├── index.ts           # HTTP server for webhooks
│   ├── vercel.ts          # Vercel serverless function entry
│   ├── bot.ts             # Bot instance creation
│   ├── config.ts          # Environment configuration
│   ├── convex-client.ts   # Convex API client
│   ├── types.ts           # TypeScript types
│   └── handlers/
│       ├── start.ts       # /start command handler
│       ├── photo.ts       # Photo message handler
│       └── results.ts     # Media group sender
├── package.json
├── tsconfig.json
├── vercel.json           # Vercel deployment config
├── .env.example
└── README.md
```

## Integration Points

### With Convex

- `collections.getBySubdomain()` - Get collection config
- `searchRequests.create()` - Create search with chat ID
- `searchRequests.get()` - Watch search progress
- `collections.updateTelegramBotToken()` - Update bot token

### With Python Service

Currently TODO - needs to be implemented:
```typescript
// In handlers/photo.ts
const response = await fetch(`${API_URL}/search`, {
  method: "POST",
  body: JSON.stringify({
    searchRequestId,
    photoUrl,
  }),
});
```

### With R2 Storage

Results are served via the web app's R2 proxy:
```
{WEBHOOK_URL}/api/r2/{subdomain}/{imageKey}
```

## Environment Variables

### Telegram App

- `CONVEX_URL` - Convex deployment URL
- `WEBHOOK_URL` - Base URL where bot is deployed
- `PORT` - Server port (default: 3002)
- `NODE_ENV` - Environment (development/production)

### Convex

- `TELEGRAM_WEBHOOK_URL` - Same as `WEBHOOK_URL` above

## Security Considerations

1. **Bot Token Protection**
   - Never commit tokens to git
   - Store in environment variables
   - Rotate tokens if compromised

2. **Webhook Validation** (TODO)
   - Implement webhook secret validation
   - Verify requests come from Telegram

3. **Rate Limiting** (TODO)
   - Limit photo uploads per user
   - Prevent spam and abuse

4. **User Data**
   - Follow Telegram's privacy policy
   - Don't store unnecessary user data
   - Handle GDPR requirements

## Future Enhancements

- [ ] Implement webhook secret validation
- [ ] Add rate limiting per user
- [ ] Support for video uploads
- [ ] Search history per user
- [ ] Admin commands for bot management
- [ ] Analytics and usage tracking
- [ ] Multi-language support
- [ ] Inline search results
- [ ] Bot settings command

## Troubleshooting

### Bot not responding

1. Check webhook status:
   ```bash
   curl https://api.telegram.org/bot{TOKEN}/getWebhookInfo
   ```

2. Check Vercel logs
3. Verify environment variables
4. Test local deployment with ngrok

### Search not working

1. Check Convex logs
2. Verify Python service is running
3. Check search request status in database
4. Review error logs

### Photos not sending

1. Verify R2 proxy is accessible
2. Check image URLs are correct
3. Ensure photos are under 10MB
4. Review Telegram API limits

## Support

For issues and questions:
- Check logs: `[Bot]`, `[Server]`, `[Convex]` prefixes
- Review Telegram Bot API docs
- Check Grammy framework docs
- Contact development team

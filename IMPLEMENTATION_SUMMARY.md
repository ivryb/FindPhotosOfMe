# Telegram Bot Implementation Summary

## What Was Built

A complete Telegram bot integration for FindPhotosOfMe using the Grammy framework. Each collection can have its own Telegram bot that allows users to search for photos by sending a selfie.

## Project Structure Created

```
apps/telegram/
├── src/
│   ├── index.ts              # HTTP webhook server (Node.js)
│   ├── vercel.ts             # Vercel serverless entry point
│   ├── bot.ts                # Bot instance creation and management
│   ├── config.ts             # Environment configuration
│   ├── convex-client.ts      # Convex API client wrapper
│   ├── types.ts              # TypeScript type definitions
│   └── handlers/
│       ├── start.ts          # /start command handler
│       ├── photo.ts          # Photo message handler
│       └── results.ts        # Media group sender for results
├── package.json              # Dependencies (grammy, convex, etc.)
├── tsconfig.json             # TypeScript configuration
├── vercel.json               # Vercel deployment configuration
├── .env.example              # Environment variables template
├── .gitignore
├── README.md                 # Bot documentation
└── DEPLOYMENT.md             # Deployment guide
```

## Backend Changes

### Convex Schema Updates (`packages/backend/convex/schema.ts`)

- Added `telegramBotToken` field to `collections` table
- Added `telegramChatId` and `telegramMessageId` fields to `searchRequests` table

### New Convex Functions (`packages/backend/convex/telegram.ts`)

- `webhook` - HTTP action to receive Telegram webhook requests
- `setWebhook` - Action to configure webhook URL on Telegram servers
- `updateBotToken` - Mutation to update collection's bot token
- `getCollectionBySubdomain` - Internal query for bot lookup
- Supporting internal functions for update processing

### Updated Convex Functions

**`packages/backend/convex/collections.ts`:**
- Updated all return types to include `telegramBotToken`
- Added `updateTelegramBotToken` mutation

**`packages/backend/convex/searchRequests.ts`:**
- Updated `create` mutation to accept optional `telegramChatId`
- Updated all return types to include Telegram fields

## Features Implemented

### 1. Bot Commands

- **`/start`**: Welcomes user and explains how to use the bot

### 2. Photo Search Flow

1. User sends photo to bot
2. Bot acknowledges with "Search started" message
3. Bot creates search request in Convex with Telegram chat ID
4. Bot polls for search completion (2-second intervals)
5. When complete, bot sends results as media groups (max 10 per group)

### 3. Media Groups

- Automatically batches results into groups of 10 (Telegram limit)
- Adds 1-second delay between batches to avoid rate limits
- First photo includes caption with result count

### 4. Webhook Architecture

- Each collection has unique webhook URL: `{BASE_URL}/webhook/{subdomain}`
- Supports both Node.js server and Vercel serverless deployment
- Webhook automatically configured when bot token is set

## Technical Decisions

### 1. Grammy Framework
- Chosen for TypeScript support and modern API
- Webhook-based (not polling) for serverless compatibility

### 2. Polling for Updates
- Used polling instead of WebSocket for search status
- ConvexHttpClient doesn't support real-time subscriptions
- 2-second polling interval is reasonable for this use case

### 3. Convex API Calls
- Used string-based API calls (`"collections:getBySubdomain"`)
- Avoided importing generated types to prevent circular dependencies
- Clean separation between bot app and backend

### 4. Deployment Options
- Supports both standalone Node.js server (for development)
- Supports Vercel serverless functions (for production)
- Health check endpoint at `/health`

## Environment Variables

### Telegram App
- `CONVEX_URL` - Convex deployment URL
- `WEBHOOK_URL` - Base URL where bot is deployed
- `PORT` - Server port (default: 3002)
- `NODE_ENV` - Environment (development/production)

### Convex
- `TELEGRAM_WEBHOOK_URL` - Same as `WEBHOOK_URL` above

## What Still Needs Implementation

### 1. Python Service Integration
Currently, the photo handler creates a search request but doesn't send the photo to the Python service. Need to add:
```typescript
const response = await fetch(`${PYTHON_API_URL}/search`, {
  method: "POST",
  body: JSON.stringify({
    searchRequestId,
    photoUrl,
  }),
});
```

### 2. Admin UI Updates
Add UI in collection settings page to:
- Input Telegram bot token
- Display current bot status
- Show webhook configuration status
- Test bot connection

### 3. Security Enhancements
- Implement webhook secret token validation
- Add rate limiting per user
- Validate Telegram request signatures

### 4. Error Handling
- Better error messages for users
- Retry logic for failed searches
- Timeout handling for long searches

## Testing Completed

- ✅ TypeScript compilation successful
- ✅ Dependencies installed
- ✅ Build passes without errors
- ⏳ Runtime testing (requires deployment and bot token)

## Next Steps

1. **Deploy to Vercel**
   ```bash
   cd apps/telegram
   vercel
   ```

2. **Set Environment Variables** in Vercel dashboard

3. **Create Test Bot** via @BotFather

4. **Add Bot Token** in collection settings (UI needs to be built)

5. **Test End-to-End**:
   - Send /start command
   - Send photo
   - Verify search request created
   - Test result delivery (once Python integration complete)

## Scripts Added

```bash
pnpm dev:telegram      # Run telegram bot in development
pnpm -F telegram-bot dev      # Alternative
pnpm -F telegram-bot build    # Build TypeScript
pnpm -F telegram-bot start    # Start production server
```

## Documentation Created

- `TELEGRAM_INTEGRATION.md` - Complete architecture and integration guide
- `apps/telegram/README.md` - Bot-specific documentation
- `apps/telegram/DEPLOYMENT.md` - Deployment instructions
- `apps/telegram/.env.example` - Environment variables template
- `IMPLEMENTATION_SUMMARY.md` - This file

## Files Modified

- `package.json` - Added `dev:telegram` script
- `turbo.json` - Added `dev:setup` task
- `README.md` - Added Telegram bot information
- `packages/backend/convex/schema.ts` - Added Telegram fields
- `packages/backend/convex/collections.ts` - Updated types and added mutation
- `packages/backend/convex/searchRequests.ts` - Updated types and create mutation

## Total Files Created

- 16 new files in `apps/telegram/`
- 1 new file in `packages/backend/convex/` (telegram.ts)
- 2 documentation files at root

## Architecture Diagram

```
User (Telegram) 
    ↓
Telegram Servers
    ↓ (webhook)
Bot App (Vercel/Node.js)
    ↓ (Convex client)
Convex Backend
    ↓ (TODO: call Python)
Python ML Service
    ↓ (R2 client)
Cloudflare R2 Storage
    ↓ (image URLs)
Bot App
    ↓ (media groups)
User (Telegram)
```

## Code Quality

- ✅ TypeScript strict mode enabled
- ✅ Detailed logging throughout
- ✅ Error handling in place
- ✅ Single responsibility principle followed
- ✅ Clear separation of concerns
- ✅ Documentation for all major functions

## Notes for Developer

1. The bot currently uses polling for search updates. This is acceptable but could be improved with WebSocket support in the future.

2. The Convex API imports use string-based function names to avoid circular dependencies. This is a temporary solution - ideally, the telegram app should be able to import generated types.

3. The webhook URL must be HTTPS in production (Telegram requirement). Local testing requires ngrok or similar tunnel.

4. Media groups are limited to 10 photos by Telegram. The bot automatically handles batching.

5. Bot tokens should never be committed to git. They're stored in Convex database and accessed via environment variables.

6. Each collection can have only one bot. Changing the bot token will update the webhook configuration automatically.

7. The Python service integration is marked as TODO in the code. Search currently creates a request but doesn't process it.

8. R2 image URLs in media groups assume the images are publicly accessible via the web app's R2 proxy.

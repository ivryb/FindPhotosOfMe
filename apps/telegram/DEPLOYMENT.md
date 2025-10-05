# Telegram Bot Deployment Guide

## Overview

This guide covers deploying the Telegram bot to Vercel using webhooks.

## Prerequisites

1. Telegram bot token from [@BotFather](https://t.me/botfather)
2. Vercel account
3. Convex deployment URL

## Deployment Steps

### 1. Deploy to Vercel

```bash
cd apps/telegram
vercel
```

Follow the prompts to create a new project or link to an existing one.

### 2. Set Environment Variables

In Vercel project settings, add:

```
CONVEX_URL=https://your-deployment.convex.cloud
WEBHOOK_URL=https://your-telegram-bot.vercel.app
```

### 3. Configure Telegram Bot Token

1. Go to your admin panel
2. Navigate to the collection settings
3. Add the Telegram bot token
4. The webhook will be automatically configured via Convex

### 4. Test the Bot

1. Open Telegram and search for your bot
2. Send `/start` command
3. Send a photo to test the search functionality

## Webhook URLs

Each collection has its own webhook URL:

```
https://your-telegram-bot.vercel.app/webhook/{collectionSubdomain}
```

## Monitoring

Check Vercel logs for webhook requests:
- Function logs show all incoming webhook events
- Look for `[Bot]`, `[Server]`, and `[Convex]` prefixed logs

## Troubleshooting

### Bot Not Responding

1. Check Vercel deployment status
2. Verify environment variables are set
3. Check Telegram webhook status:
   ```bash
   curl https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo
   ```

### Photos Not Sending

1. Verify R2 URLs are accessible
2. Check that collection has images
3. Ensure Python service is running and connected

### Search Not Working

1. Verify Python API is accessible
2. Check Convex search request status
3. Review logs for errors

## Local Testing

For local development, use a tunnel service like ngrok:

```bash
# Start the bot locally
pnpm dev

# In another terminal, start ngrok
ngrok http 3002

# Update WEBHOOK_URL to ngrok URL
# Set webhook manually:
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-ngrok-url.ngrok.io/webhook/{subdomain}"}'
```

## Security Notes

1. **Never commit bot tokens** - Always use environment variables
2. **Validate webhook requests** - Consider adding webhook secret validation
3. **Rate limiting** - Implement rate limiting for photo uploads
4. **User privacy** - Handle user data according to Telegram's privacy policy

## Production Checklist

- [ ] Environment variables configured in Vercel
- [ ] Bot token set in collection settings
- [ ] Webhook URL is HTTPS
- [ ] R2 proxy is accessible
- [ ] Python service is running
- [ ] Convex deployment is live
- [ ] Error monitoring is set up
- [ ] Bot tested end-to-end

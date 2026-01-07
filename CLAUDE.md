# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FindPhotosOfMe is a face recognition photo search application. Users upload a reference photo, and the system finds matching photos from large collections using ML embeddings.

## Architecture

Three-layer monorepo:
- **apps/web**: Nuxt 3 frontend (port 3001)
- **packages/backend/convex**: Convex serverless backend
- **python**: FastAPI ML service with InsightFace

Data flow: Photos → R2 storage → Python extracts embeddings → Convex stores metadata → Frontend subscribes to real-time updates

## Development Commands

```bash
# Full stack
pnpm install          # Install dependencies
pnpm dev              # Run all services (web + Convex)
pnpm dev:setup        # Initialize Convex

# Individual services
pnpm dev:web          # Frontend only
pnpm dev:server       # Convex only

# Python service (from repo root)
./deploy-python-local.sh      # Build and run Docker container
./stop-python-local.sh        # Stop container
docker logs -f find-photos-of-me-service  # View logs

# Type checking
pnpm check-types      # All workspaces
```

## Convex Backend Patterns

Use new function syntax with explicit validators:
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const myQuery = query({
  args: { id: v.id("collections") },
  returns: v.string(),
  handler: async (ctx, args) => { ... }
});
```

- Always include `returns:` validator (use `v.null()` for void)
- Never use `.filter()` - define indexes in schema.ts
- Call functions via `ctx.runQuery(api.module.fn, args)`, not directly
- Status pattern: `not_started` → `processing` → `complete` | `error`

## Vue/Nuxt Frontend Patterns

```typescript
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { useConvexQuery, useConvexMutation } from "convex-vue";
```

- Use `<script setup lang="ts">` with Composition API
- UI components from `@/components/ui/` (shadcn-vue)
- Icons from `lucide-vue-next`

## Python Service

- FastAPI with endpoints in `python/endpoints/`
- Service classes in `python/services/` (FaceRecognition, R2Storage, ConvexClient)
- Uses InsightFace for face detection/embeddings
- **Detailed logging required**: `print(f"[{get_time()}] Action: {details}")`

## Cross-Service Communication

- Frontend → Convex: Direct imports via `@FindPhotosOfMe/backend/convex/_generated/api`
- Frontend → Python: HTTP to `NUXT_PUBLIC_API_URL`
- Python → Convex: Python SDK for mutations
- Python → R2: Boto3 S3-compatible client

## File Naming

- Vue components: PascalCase (`SearchForm.vue`)
- Composables: `use` prefix (`useConvexSSRQuery.ts`)
- Convex functions: camelCase (`collections.ts`)
- Python: snake_case (`face_recognition_service.py`)

## Key Files

- `packages/backend/convex/schema.ts` - Database schema
- `apps/web/nuxt.config.ts` - Nuxt configuration
- `python/main.py` - FastAPI entry point

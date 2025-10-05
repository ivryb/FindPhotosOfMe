# Architecture Overview

FindPhotosOfMe is a face recognition service that helps users find photos of themselves from large photo collections. The system uses machine learning to analyze faces and match them across thousands of images.

### Tech Stack

- **Frontend**: Nuxt 4 + Vue 3 + TypeScript + shadcn-vue components
- **Backend**: Convex (real-time database and functions)
- **ML Service**: Python FastAPI with InsightFace for face recognition
- **Storage**: Cloudflare R2 for photo storage
- **Monorepo**: pnpm workspaces + Turborepo

### Data Flow

1. Admin uploads photo collection (zip) → Python service processes faces → stores in R2 + Convex
2. User uploads reference photo → Python service compares against stored embeddings → returns matches
3. Frontend subscribes to real-time progress updates via Convex

## Development Commands

### Root Level (Turborepo)

```bash
pnpm install              # Install all workspace dependencies
pnpm dev                  # Run all services (web + backend + python)
pnpm build                # Build all packages
pnpm check-types          # Type check all packages
pnpm dev:web              # Run only frontend
pnpm dev:server           # Run only Convex backend
pnpm dev:setup            # Initialize Convex development environment
```

### Python Service

```bash
# In python/ directory
pip install -r requirements.txt
./deploy-local.sh         # Build and run Docker container locally
./stop-local.sh           # Stop local Docker container
docker logs -f find-photos-of-me-service  # View service logs
./manage-models-volume.sh info             # Manage cached ML models
```

### Frontend (apps/web)

```bash
npm run dev               # Development server
npm run build            # Production build
npm run preview          # Preview production build
```

### Backend (packages/backend)

```bash
npm run dev              # Start Convex development
npm run dev:setup        # Configure Convex project
```

## Project Structure

```
FindPhotosOfMe/
├── apps/web/                    # Nuxt frontend application
│   ├── app/                     # Nuxt app directory
│   │   ├── components/          # Vue components (shadcn-vue)
│   │   ├── composables/         # Vue composables
│   │   └── pages/              # Nuxt pages/routes
├── packages/backend/            # Convex backend
│   └── convex/                 # Convex functions and schema
│       └── schema.ts           # Database schema (collections, searchRequests)
└── python/                     # FastAPI ML service
    ├── endpoints/              # API endpoints
    │   ├── upload_collection.py # Process photo collections
    │   └── search_photos.py    # Face matching search
    ├── services/               # Core business logic
    └── schemas/                # Pydantic models
```

## Key Components

### Convex Schema (packages/backend/convex/schema.ts)

- `collections`: Photo collection metadata with processing status
- `searchRequests`: Face search jobs with results and progress
- Uses status tracking pattern: `not_started` → `processing` → `complete`/`error`

### Python Service Architecture

- **FastAPI**: REST API with two main endpoints
- **InsightFace**: Face detection and embedding generation
- **Cloudflare R2**: Object storage for photos
- **Convex Python SDK**: Real-time progress updates

### Frontend Integration

- **Convex-Vue**: Real-time reactive queries and mutations
- **shadcn-vue**: UI component library
- **Nuxt**: Server-side rendering and routing

## Environment Variables

### Python Service (.env in python/)

```bash
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_bucket_name
CONVEX_URL=https://your-deployment.convex.cloud
CORS_ORIGINS=*
```

### Convex (set via Convex dashboard or CLI)

```bash
CONVEX_DEPLOYMENT=your-deployment-name
```

## Development Patterns

### Convex Functions

- Use TypeScript with strict typing via `v` validators
- Mutations for data changes, queries for reads, actions for external calls
- Index frequently queried fields (e.g., `by_status`, `by_collection`)

### Python Service

- Async/await patterns for I/O operations
- Detailed logging for ML processing steps
- Progress tracking via Convex mutations during long operations
- Service classes: `FaceRecognition`, `R2Storage`, `ConvexClient`

### Frontend (Vue/Nuxt)

- Composition API pattern
- `useConvexQuery` for reactive data
- `useConvexMutation` for data updates
- TypeScript integration with Convex-generated types

## Testing

Tests are not currently implemented. When adding tests:

- Frontend: Use Vitest + Vue Test Utils
- Python: Use pytest
- Convex: Use Convex test framework

## Deployment

### Python Service

Uses Docker with Cloud Run/similar container platforms. Models (~400MB) are cached in persistent volume.

### Frontend + Backend

Standard Nuxt deployment + Convex managed hosting.

# Find Photos of Me - Processing Service

Face recognition service that processes photo collections and enables searching for specific people in large photo archives.

## Architecture

The service consists of two main endpoints:

### 1. Upload Collection (`/api/upload-collection`)
- Accepts a zip archive of photos with a collection ID
- Extracts face embeddings from each photo
- Stores photos in Cloudflare R2 storage
- Saves embeddings metadata for fast searching
- Updates progress in real-time via Convex

### 2. Search Photos (`/api/search-photos`)
- Accepts a reference photo and search request ID
- Compares reference face against all stored embeddings
- Returns matching photos with similarity scores
- Updates search progress via Convex

## Tech Stack

- **FastAPI**: REST API framework
- **InsightFace**: Face detection and recognition
- **Cloudflare R2**: Object storage for photos
- **Convex**: Real-time database for metadata and progress tracking
- **OpenCV**: Image processing

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure environment variables (see `.env.example`)

3. Run with Docker:
   ```bash
   docker build -t photo-service .
   docker run -p 8000:8000 --env-file .env photo-service
   ```

## API Endpoints

- `POST /api/upload-collection` - Upload and process photo collection
- `POST /api/search-photos` - Search for matching faces
- `GET /health` - Health check

## Data Flow

1. Admin creates collection in Nuxt app → receives `collectionId`
2. Admin uploads zip archive to `/api/upload-collection`
3. Service processes photos, stores in R2, updates Convex progress
4. User creates search request in Nuxt → receives `searchRequestId`
5. User uploads reference photo to `/api/search-photos`
6. Service compares faces, updates results in Convex
7. User views matching photos in Nuxt app

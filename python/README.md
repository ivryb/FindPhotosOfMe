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

2. Configure environment variables:

   Create a `.env` file in the `python/` directory:

   ```bash
   R2_ACCOUNT_ID=your_r2_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key_id
   R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
   R2_BUCKET_NAME=your_bucket_name
   CONVEX_URL=https://your-convex-deployment-url.convex.cloud
   CORS_ORIGINS=*
   ```

3. Run locally with Docker:

   ```bash
   ./deploy-local.sh
   ```

   This script will:
   - Build the Docker image
   - Create a persistent Docker volume for models (if not exists)
   - Load environment variables from `.env`
   - Run the container on port 8000 (in detached mode)
   - Verify all required credentials are present
   - Automatically stop/remove any existing container

   To stop the service:

   ```bash
   ./stop-local.sh
   ```

   View logs:

   ```bash
   docker logs -f find-photos-of-me-service
   ```

**Note**: InsightFace models (~400MB) will be downloaded automatically on first run and cached in a persistent Docker volume (`insightface-models`). The models persist across container restarts, so they only need to be downloaded once.

### Managing Model Cache

Use the `manage-models-volume.sh` script to manage the cached models:

```bash
# View volume information and size
./manage-models-volume.sh info

# Backup the models (useful before cleaning)
./manage-models-volume.sh backup

# Clean the volume (models will be re-downloaded on next run)
./manage-models-volume.sh clean

# Restore from a backup
./manage-models-volume.sh restore
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

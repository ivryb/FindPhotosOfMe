# Deployment Configuration

## Python ML Service

### Railway Deployment

Configure your Railway service with:

- **Root Directory**: `/` (repository root)
- **Dockerfile Path**: `Dockerfile.python`
- **Build Context**: `.` (root)

### Google Cloud Run Deployment

**Important**: For large file uploads (>32MB), Cloud Run requires specific configuration:

```bash
gcloud run deploy find-photos-of-me \
  --source . \
  --dockerfile Dockerfile.python \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --timeout=3600 \
  --memory=2Gi \
  --cpu=2 \
  --max-instances=10 \
  --request-timeout=3600s
```

**Key Flags for Large Uploads:**

- `--timeout=3600`: Request timeout (1 hour) for processing large collections
- `--memory=2Gi`: Sufficient memory for face recognition processing
- `--cpu=2`: Faster processing with 2 vCPUs
- `--request-timeout=3600s`: Allow long-running requests for streaming uploads

**Note**: The 32MB limit applies only to non-streaming requests. The updated endpoint uses streaming, which bypasses this limit.

Or if using `cloudbuild.yaml`:

```yaml
steps:
  - name: "gcr.io/cloud-builders/docker"
    args:
      [
        "build",
        "-f",
        "Dockerfile.python",
        "-t",
        "gcr.io/$PROJECT_ID/find-photos-of-me",
        ".",
      ]
  - name: "gcr.io/cloud-builders/docker"
    args: ["push", "gcr.io/$PROJECT_ID/find-photos-of-me"]
  - name: "gcr.io/google.com/cloudsdktool/cloud-sdk"
    entrypoint: gcloud
    args:
      - "run"
      - "deploy"
      - "find-photos-of-me"
      - "--image"
      - "gcr.io/$PROJECT_ID/find-photos-of-me"
      - "--region"
      - "us-central1"
      - "--platform"
      - "managed"
```

### Local Development

From repository root:

```bash
# Start service (native platform - fast for local dev)
./deploy-python-local.sh

# Start service (linux/amd64 - test production build)
./deploy-python-local.sh --linux

# Combine flags
./deploy-python-local.sh --linux --no-cache

# Stop service
./stop-python-local.sh

# View logs
docker logs -f find-photos-of-me-service
```

**Flags:**

- `--linux`: Build for linux/amd64 platform (matches Railway/Cloud Run)
- `--no-cache`: Force rebuild without using Docker cache

### Environment Variables Required

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `CONVEX_URL`
- `CORS_ORIGINS` (optional, defaults to `*`)
- `PORT` (optional, defaults to `8000`)

## Notes

- **Architecture**:
  - By default, builds for native platform (arm64 on Apple Silicon, fast for local dev)
  - Use `--linux` flag to build for `linux/amd64` (matches Railway/Cloud Run)
  - Railway/Cloud Run automatically build for `linux/amd64`
- **onnxruntime Fix**: The Dockerfile uses `patchelf --clear-execstack` to fix executable stack issues on containerized platforms (Railway, Cloud Run)
- **Build Context**: Always the repository root
- **Python Code**: Located in `python/` directory but gets copied to `/app` in the container

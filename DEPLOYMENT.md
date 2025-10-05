# Deployment Configuration

## Python ML Service

### Railway Deployment

Configure your Railway service with:

- **Root Directory**: `/` (repository root)
- **Dockerfile Path**: `Dockerfile.python`
- **Build Context**: `.` (root)

### Google Cloud Run Deployment

Use the following command:

```bash
gcloud run deploy find-photos-of-me \
  --source . \
  --dockerfile Dockerfile.python \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

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
# Start service
./deploy-python-local.sh [--no-cache]

# Stop service
./stop-python-local.sh

# View logs
docker logs -f find-photos-of-me-service
```

### Environment Variables Required

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `CONVEX_URL`
- `CORS_ORIGINS` (optional, defaults to `*`)
- `PORT` (optional, defaults to `8000`)

## Notes

- The Dockerfile includes a fix for onnxruntime executable stack issues on containerized platforms (Railway, Cloud Run)
- Build context is always the repository root
- Python code is in `python/` directory but gets copied to `/app` in the container

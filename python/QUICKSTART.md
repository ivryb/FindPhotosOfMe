# Quick Start Guide

Get your face detection service running on Google Cloud Run in 10 minutes!

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed ([install here](https://cloud.google.com/sdk/docs/install))
- A zip file with images to process

## 5-Step Deployment

### 1. Install and Configure Google Cloud CLI

```bash
# Install gcloud CLI (if not already installed)
# Visit: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud auth application-default login

# Create/select a project
gcloud projects create face-detection-PROJECT_ID  # or use existing
gcloud config set project YOUR_PROJECT_ID
```

### 2. Create a Storage Bucket

```bash
# Replace with your bucket name
export BUCKET_NAME="face-detection-$(date +%s)"

# Create bucket
gsutil mb -l us-central1 gs://${BUCKET_NAME}/

# Verify
gsutil ls
```

### 3. Deploy to Cloud Run

```bash
cd /workspace/python

# Set your project ID
export GCP_PROJECT_ID="YOUR_PROJECT_ID"

# Deploy (this will take 5-10 minutes)
./deploy.sh
```

The script will:
- ✅ Enable required APIs
- ✅ Build Docker container
- ✅ Deploy to Cloud Run
- ✅ Output your service URL

### 4. Test the Service

Save the service URL from the deployment output, then:

```bash
# Set your service URL
export SERVICE_URL="https://face-detection-service-xxxx.run.app"

# Test health check
curl ${SERVICE_URL}/health

# Process a zip file
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=${BUCKET_NAME}" \
  ${SERVICE_URL}/process-zip
```

### 5. View Results

```bash
# List processed images
gsutil ls gs://${BUCKET_NAME}/face-processing-*/images/

# Download an embedding file
gsutil cat gs://${BUCKET_NAME}/face-processing-*/embeddings/photo1.json

# View summary
gsutil cat gs://${BUCKET_NAME}/face-processing-*/summary.json
```

## 🎉 Done!

Your face detection service is now running on Google Cloud Run!

## What's Next?

### View Logs

```bash
gcloud run services logs tail face-detection-service --region us-central1
```

### Monitor Costs

- Visit [GCP Console → Billing](https://console.cloud.google.com/billing)
- Set up budget alerts

### Process More Images

```bash
# Using the Python client
python example_client.py \
  --url ${SERVICE_URL} \
  --action process \
  --zip-file large-dataset.zip \
  --bucket ${BUCKET_NAME} \
  --base-path batch-$(date +%Y%m%d)
```

### Find Matching Faces

```bash
# Compare a reference face with processed images
python example_client.py \
  --url ${SERVICE_URL} \
  --action compare \
  --reference-image ref.jpg \
  --bucket ${BUCKET_NAME} \
  --base-path family-reunion-2024 \
  --similarity-threshold 0.6 \
  --top-n 10
```

### Local Testing

Before deploying changes:

```bash
# Test locally with Docker
./deploy-local.sh

# In another terminal
./test-endpoint.sh http://localhost:8080 images.zip test-bucket
```

## Common Commands

### Redeploy After Changes

```bash
# Edit app.py, then
./deploy.sh
```

### Download All Embeddings

```bash
# Download embeddings from a specific batch
gsutil -m cp -r gs://${BUCKET_NAME}/batch-20251003/embeddings/ ./local-embeddings/
```

### Delete Service

```bash
# When you're done
gcloud run services delete face-detection-service --region us-central1
```

### Delete Bucket

```bash
# Clean up storage
gsutil -m rm -r gs://${BUCKET_NAME}
```

## Troubleshooting

### "Permission denied" when accessing GCS

```bash
# Grant permissions to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format='value(projectNumber)')

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"
```

### "Out of memory" errors

Edit `deploy.sh` and increase memory:

```bash
MEMORY="8Gi"  # Increase from 4Gi
```

Then redeploy:

```bash
./deploy.sh
```

### Service timing out

Increase timeout in `deploy.sh`:

```bash
TIMEOUT="3600"  # Max allowed by Cloud Run
```

Or process smaller batches:

```bash
# Split your zip file into smaller chunks
# Process each chunk separately
```

## Cost Estimate

Typical costs for Cloud Run (us-central1):

- **CPU**: ~$0.024 per vCPU-hour
- **Memory**: ~$0.0025 per GB-hour
- **Requests**: $0.40 per million

**Example**: Processing 1000 images (takes ~10 minutes with 2 CPU, 4GB RAM):
- Compute: ~$0.013
- Requests: ~$0.0004
- **Total**: ~$0.02 per 1000 images

Plus GCS storage costs: ~$0.02 per GB/month

💡 **Tip**: Set `--min-instances=0` to scale to zero when idle (included in deploy script)

## Example Workflow

```bash
# 1. Collect images into a zip file
zip -r family-photos.zip ~/Photos/2024/

# 2. Process with the service
curl -X POST \
  -F "zip_file=@family-photos.zip" \
  -F "bucket_name=${BUCKET_NAME}" \
  -F "base_path=family-photos-2024" \
  ${SERVICE_URL}/process-zip

# 3. Download results
gsutil -m cp -r gs://${BUCKET_NAME}/family-photos-2024/ ./results/

# 4. Analyze embeddings
python analyze_faces.py --embeddings-dir ./results/embeddings/
```

## Need Help?

- 📖 Full documentation: `README_CLOUD_RUN.md`
- 🔄 Migration guide: `MIGRATION_GUIDE.md`
- 📊 View logs: `gcloud run services logs read face-detection-service`
- 🌐 Cloud Run docs: https://cloud.google.com/run/docs

## Clean Up (When Done Testing)

```bash
# Delete the service
gcloud run services delete face-detection-service --region us-central1 --quiet

# Delete the bucket
gsutil -m rm -r gs://${BUCKET_NAME}

# Delete container images (optional)
gcloud container images delete gcr.io/${GCP_PROJECT_ID}/face-detection-service --quiet
```

---

**Happy face detecting! 🎭📸**

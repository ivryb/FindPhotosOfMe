# Face Detection Service - Google Cloud Run

This service provides a REST API for processing images in zip files, detecting faces, extracting embeddings, and storing results in Google Cloud Storage. The service is designed to run on Google Cloud Run with streaming capabilities to handle large zip files efficiently.

## Features

- **Streaming Zip Processing**: Processes images as they are extracted from the zip file, avoiding memory issues with large datasets
- **Face Detection**: Uses InsightFace (buffalo_l model) for accurate face detection
- **Embedding Extraction**: Extracts 512-dimensional face embeddings for each detected face
- **Gender Detection**: Identifies gender for each detected face
- **Cloud Storage Integration**: Automatically uploads images and embeddings to Google Cloud Storage
- **Parallel Processing**: Processes multiple images concurrently for better performance
- **Production Ready**: Runs with Gunicorn for production workloads

## Architecture

```
Client → Upload ZIP → Cloud Run Service → Process Images Stream
                           ↓
                    Extract Faces & Embeddings
                           ↓
                    Upload to GCS
                           ↓
                    {images/, embeddings/, summary.json}
```

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed locally ([installation guide](https://cloud.google.com/sdk/docs/install))
3. **Docker** installed for local testing (optional)
4. **Google Cloud Storage bucket** created for storing results

## Setup

### 1. Install Google Cloud SDK

```bash
# Follow instructions at: https://cloud.google.com/sdk/docs/install

# After installation, authenticate
gcloud auth login
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Create a GCS Bucket

```bash
# Create a bucket for storing processed images and embeddings
gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://your-bucket-name/
```

### 3. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
```

## Deployment

### Deploy to Google Cloud Run

```bash
# Make the deployment script executable
chmod +x deploy.sh

# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export SERVICE_NAME="face-detection-service"
export REGION="us-central1"

# Deploy
./deploy.sh
```

The deployment script will:
1. Build the Docker image using Cloud Build
2. Deploy to Cloud Run with appropriate settings:
   - Memory: 4GB (configurable)
   - CPU: 2 (configurable)
   - Timeout: 3600s (1 hour)
   - Auto-scaling with min 0, max 10 instances
3. Return the service URL

### Local Testing with Docker

```bash
# Make the script executable
chmod +x deploy-local.sh

# Build and run locally
./deploy-local.sh
```

This will start the service at `http://localhost:8080`

## API Endpoints

### 1. Health Check

**GET** `/health`

Returns the service health status.

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-03T12:00:00.000000"
}
```

### 2. Process Zip File

**POST** `/process-zip`

Processes a zip file containing images, detects faces, extracts embeddings, and uploads to GCS.

**Request:**
- Content-Type: `multipart/form-data`
- Parameters:
  - `zip_file` (file, required): The zip file containing images
  - `bucket_name` (string, required): GCS bucket name for storing results
  - `base_path` (string, optional): Base path in the bucket (defaults to `face-processing/{timestamp}`)
  - `max_workers` (int, optional): Number of parallel workers (default: 4)

**Example:**

```bash
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  -F "max_workers=4" \
  https://your-service-url.run.app/process-zip
```

**Response:**

```json
{
  "success": true,
  "summary": {
    "bucket_name": "my-bucket",
    "base_path": "batch-001",
    "total_images": 100,
    "processed_successfully": 95,
    "errors": 5,
    "completed_at": "2025-10-03T12:30:00.000000"
  },
  "summary_path": "batch-001/summary.json",
  "results": [
    {
      "image_name": "photo1.jpg",
      "image_path": "batch-001/images/photo1.jpg",
      "embeddings_path": "batch-001/embeddings/photo1.json",
      "faces_count": 2,
      "faces": [
        {
          "face_index": 0,
          "embedding": [0.123, -0.456, ...],
          "gender": "male",
          "bbox": [x1, y1, x2, y2]
        }
      ]
    }
  ]
}
```

### 3. Compare Faces

**POST** `/compare-faces`

Compares a reference face with all stored embeddings to find matching faces.

**Request (File Upload):**
- Content-Type: `multipart/form-data`
- Parameters:
  - `reference_image` (file, required): Reference image with face to find
  - `bucket_name` (string, required): GCS bucket name
  - `base_path` (string, required): Base path containing embeddings
  - `similarity_threshold` (float, optional): Minimum similarity (default: 0.6)
  - `gender_match` (boolean, optional): Require gender match (default: true)
  - `return_top_n` (int, optional): Limit results to top N matches

**Request (JSON with GCS path):**
- Content-Type: `application/json`
- Parameters:
  - `reference_image_gcs_path` (string, required): GCS path to reference image
  - `bucket_name` (string, required): GCS bucket name
  - `base_path` (string, required): Base path containing embeddings
  - `similarity_threshold` (float, optional): Minimum similarity (default: 0.6)
  - `gender_match` (boolean, optional): Require gender match (default: true)
  - `return_top_n` (int, optional): Limit results to top N matches

**Example:**

```bash
curl -X POST \
  -F "reference_image=@ref.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  -F "similarity_threshold=0.6" \
  -F "gender_match=true" \
  -F "return_top_n=10" \
  https://your-service-url.run.app/compare-faces
```

**Response:**

```json
{
  "success": true,
  "reference_gender": "male",
  "similarity_threshold": 0.6,
  "gender_match_required": true,
  "total_images_checked": 100,
  "total_faces_checked": 150,
  "matches_found": 12,
  "matches": [
    {
      "image_name": "photo1.jpg",
      "image_path": "batch-001/images/photo1.jpg",
      "face_index": 0,
      "similarity": 0.8542,
      "gender": "male",
      "bbox": [100, 200, 300, 400]
    }
  ]
}
```

For detailed usage, see **[FACE_COMPARISON_GUIDE.md](FACE_COMPARISON_GUIDE.md)**

## Storage Structure

After processing, the following structure is created in your GCS bucket:

```
gs://your-bucket/
└── {base_path}/
    ├── images/
    │   ├── photo1.jpg
    │   ├── photo2.jpg
    │   └── ...
    ├── embeddings/
    │   ├── photo1.json
    │   ├── photo2.json
    │   └── ...
    └── summary.json
```

### Embedding JSON Format

Each embedding file contains:

```json
{
  "image_name": "photo1.jpg",
  "image_path": "batch-001/images/photo1.jpg",
  "faces_count": 1,
  "faces": [
    {
      "face_index": 0,
      "embedding": [512-dimensional array],
      "gender": "male",
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "processed_at": "2025-10-03T12:00:00.000000"
}
```

## Testing

### Using the Test Script

```bash
# Make the script executable
chmod +x test-endpoint.sh

# Test locally
./test-endpoint.sh http://localhost:8080 images.zip my-bucket

# Test deployed service
./test-endpoint.sh https://your-service.run.app images.zip my-bucket
```

### Creating a Test Zip File

```bash
# Create a directory with some images
mkdir test_images
cp *.jpg test_images/

# Create a zip file
zip -r images.zip test_images/
```

## Performance Tuning

### Memory and CPU

Adjust in `deploy.sh`:

```bash
MEMORY="4Gi"  # Increase for processing larger images or more parallel workers
CPU="2"       # Increase for better performance
```

### Parallel Processing

Control the number of parallel workers when calling the API:

```bash
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  -F "max_workers=8" \  # Increase for more parallelism
  https://your-service.run.app/process-zip
```

### Timeout

For very large zip files, increase the timeout in `deploy.sh`:

```bash
TIMEOUT="3600"  # 1 hour (max allowed by Cloud Run)
```

## Cost Optimization

1. **Set min instances to 0**: Scales down when not in use
2. **Use appropriate memory/CPU**: Don't over-provision
3. **Process in batches**: Split very large datasets into multiple requests
4. **Use Cloud Storage lifecycle policies**: Archive old data

## Monitoring

### View Logs

```bash
# View recent logs
gcloud run services logs read face-detection-service --region us-central1 --limit 50

# Tail logs in real-time
gcloud run services logs tail face-detection-service --region us-central1
```

### View Metrics

Visit the Google Cloud Console:
1. Navigate to Cloud Run
2. Select your service
3. Click on "Metrics" tab

## Troubleshooting

### Out of Memory Errors

- Increase memory allocation in `deploy.sh`
- Reduce `max_workers` parameter
- Process smaller zip files

### Timeout Errors

- Increase timeout in `deploy.sh` (max 3600s)
- Process in smaller batches
- Optimize image processing

### GCS Upload Errors

- Verify bucket exists and service has permissions
- Check if the service account has Storage Object Admin role:

```bash
# Grant permissions to Cloud Run service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"
```

## Security

### Authentication

By default, the service is deployed with `--allow-unauthenticated`. For production:

```bash
# Deploy with authentication required
gcloud run deploy face-detection-service \
    --image gcr.io/YOUR_PROJECT_ID/face-detection-service \
    --region us-central1 \
    --no-allow-unauthenticated
```

Then make authenticated requests:

```bash
# Get auth token
TOKEN=$(gcloud auth print-identity-token)

# Make authenticated request
curl -H "Authorization: Bearer $TOKEN" \
  -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  https://your-service.run.app/process-zip
```

## Migration from Local Version

The original `main.py` logic has been preserved in the new `app.py`:

- ✅ Same face detection model (buffalo_l)
- ✅ Same embedding extraction
- ✅ Same similarity calculation method
- ✅ Same requirements versions
- ✅ Gender detection preserved
- ✅ Enhanced with streaming and cloud storage

## Next Steps

1. ✅ Implement face comparison endpoint for matching against reference - **DONE!**
2. Add batch processing for comparing multiple reference faces
3. Implement webhook notifications when processing completes
4. Add support for video processing
5. Implement face clustering algorithms

## Support

For issues or questions:
- Check Cloud Run logs: `gcloud run services logs read face-detection-service`
- Review the [Cloud Run documentation](https://cloud.google.com/run/docs)
- Check [InsightFace documentation](https://github.com/deepinsight/insightface)

## License

Same as the original project.

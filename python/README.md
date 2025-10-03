# Face Detection Service

A scalable face detection and embedding extraction service that runs on Google Cloud Run. This service processes images from zip files, detects faces using InsightFace, extracts embeddings, and stores results in Google Cloud Storage with streaming capabilities to handle large datasets efficiently.

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 10 minutes
- **[README_CLOUD_RUN.md](README_CLOUD_RUN.md)** - Complete documentation
- **[FACE_COMPARISON_GUIDE.md](FACE_COMPARISON_GUIDE.md)** - Face comparison usage guide
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Detailed migration guide from local version

## 🚀 Quick Start

```bash
# 1. Deploy to Google Cloud Run
export GCP_PROJECT_ID="your-project-id"
./deploy.sh

# 2. Test the service
./test-endpoint.sh https://your-service.run.app images.zip your-bucket
```

## ✨ Features

- ✅ **Streaming Processing**: Process images as they're extracted from zip files
- ✅ **Face Detection**: InsightFace (buffalo_l) for accurate detection
- ✅ **Embedding Extraction**: 512-dimensional face embeddings
- ✅ **Gender Detection**: Automatic gender classification
- ✅ **Cloud Storage**: Automatic upload to Google Cloud Storage
- ✅ **Parallel Processing**: Multi-threaded image processing
- ✅ **Auto-scaling**: Scales from 0 to 10+ instances automatically
- ✅ **Production Ready**: Gunicorn server with proper error handling

## 📦 What's Included

### Core Files

- **`app.py`** - Flask API application with streaming zip processing
- **`main.py`** - Original local processing script (still works!)
- **`requirements.txt`** - Python dependencies with pinned versions

### Docker & Deployment

- **`Dockerfile`** - Container definition for Cloud Run
- **`deploy.sh`** - One-command deployment to Cloud Run
- **`deploy-local.sh`** - Local Docker testing
- **`.dockerignore`** / **`.gcloudignore`** - Build optimization

### Testing & Examples

- **`test-endpoint.sh`** - API testing script
- **`example_client.py`** - Python client for the API

### Documentation

- **`QUICKSTART.md`** - 10-minute setup guide
- **`README_CLOUD_RUN.md`** - Complete documentation
- **`MIGRATION_GUIDE.md`** - Migration from local to cloud
- **`README.md`** - This file

## 🎯 Use Cases

1. **Photo Organization**: Find all photos containing a specific person
2. **Event Photography**: Identify attendees in large photo collections
3. **Family Albums**: Organize family photos by person
4. **Security**: Face-based photo filtering and classification
5. **Research**: Large-scale face dataset processing

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ Upload ZIP
       ▼
┌─────────────────────────┐
│   Cloud Run Service     │
│  ┌──────────────────┐   │
│  │  Stream ZIP      │   │
│  │  Extract Images  │   │
│  │  Detect Faces    │   │
│  │  Get Embeddings  │   │
│  └─────────┬────────┘   │
└────────────┼────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Google Cloud       │
    │ Storage            │
    │ ┌────────────────┐ │
    │ │ images/        │ │
    │ │ embeddings/    │ │
    │ │ summary.json   │ │
    │ └────────────────┘ │
    └────────────────────┘
```

## 🔧 Technology Stack

- **Face Detection**: InsightFace (buffalo_l model)
- **Web Framework**: Flask
- **Server**: Gunicorn
- **Storage**: Google Cloud Storage
- **Container**: Docker
- **Platform**: Google Cloud Run
- **Language**: Python 3.12

## 💻 Local Development

### Test Locally with Docker

```bash
# Build and run
./deploy-local.sh

# Test in another terminal
curl http://localhost:8080/health
```

### Run Without Docker

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

## 🌐 API Endpoints

### Health Check

```bash
GET /health
```

### Process Zip File

```bash
POST /process-zip
Content-Type: multipart/form-data

Parameters:
- zip_file: ZIP file with images
- bucket_name: GCS bucket name
- base_path: Base path in bucket (optional)
- max_workers: Parallel workers (optional, default: 4)
```

### Example Request

```bash
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  https://your-service.run.app/process-zip
```

### Example Response

```json
{
  "success": true,
  "summary": {
    "bucket_name": "my-bucket",
    "base_path": "batch-001",
    "total_images": 100,
    "processed_successfully": 95,
    "errors": 5,
    "completed_at": "2025-10-03T12:00:00"
  },
  "summary_path": "batch-001/summary.json",
  "results": [...]
}
```

### Compare Faces

```bash
POST /compare-faces
Content-Type: multipart/form-data OR application/json

Parameters (multipart):
- reference_image: Reference image file
- bucket_name: GCS bucket name
- base_path: Base path containing embeddings
- similarity_threshold: Minimum similarity (optional, default: 0.6)
- gender_match: Require gender match (optional, default: true)
- return_top_n: Limit results (optional)

Parameters (JSON):
- reference_image_gcs_path: GCS path to reference image
- bucket_name: GCS bucket name
- base_path: Base path containing embeddings
- similarity_threshold: Minimum similarity (optional, default: 0.6)
- gender_match: Require gender match (optional, default: true)
- return_top_n: Limit results (optional)
```

### Example Request (File Upload)

```bash
curl -X POST \
  -F "reference_image=@ref.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  -F "similarity_threshold=0.6" \
  -F "gender_match=true" \
  https://your-service.run.app/compare-faces
```

### Example Response

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

## 📊 Output Structure

```
gs://your-bucket/
└── batch-001/
    ├── images/
    │   ├── photo1.jpg
    │   └── photo2.jpg
    ├── embeddings/
    │   ├── photo1.json
    │   └── photo2.json
    └── summary.json
```

### Embedding Format

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
  "processed_at": "2025-10-03T12:00:00"
}
```

## 🐍 Python Client

```python
from example_client import FaceDetectionClient

# Initialize client
client = FaceDetectionClient("https://your-service.run.app")

# Check health
health = client.health_check()
print(health)

# Process images
result = client.process_zip(
    zip_file_path="images.zip",
    bucket_name="my-bucket",
    base_path="batch-001",
    max_workers=4
)

print(f"Processed: {result['summary']['processed_successfully']} images")

# Compare faces
comparison = client.compare_faces(
    reference_image_path="ref.jpg",
    bucket_name="my-bucket",
    base_path="batch-001",
    similarity_threshold=0.6,
    gender_match=True,
    return_top_n=10
)

print(f"Found {comparison['matches_found']} matching faces")
for match in comparison['matches']:
    print(f"{match['image_name']}: {match['similarity']:.4f}")

# Download embeddings
embeddings = client.download_embeddings(
    bucket_name="my-bucket",
    base_path="batch-001",
    output_dir="./embeddings"
)
```

## 📈 Performance

- **Throughput**: ~10-20 images/second (depends on image size and instance specs)
- **Memory**: 4GB default (configurable)
- **CPU**: 2 vCPU default (configurable)
- **Timeout**: 1 hour max
- **Concurrent Processing**: 4 workers default (configurable)

## 💰 Cost Estimate

Example for processing 10,000 images:

- **Compute**: ~$0.20 (2 vCPU, 4GB RAM, ~1.5 hours)
- **Storage**: ~$0.02 per GB/month
- **Requests**: Negligible
- **Total**: ~$0.22 for 10,000 images

💡 Costs scale to zero when not in use!

## 🔐 Security

### Enable Authentication

```bash
# Deploy with auth required
gcloud run deploy face-detection-service \
    --no-allow-unauthenticated \
    --region us-central1
```

### Make Authenticated Requests

```bash
TOKEN=$(gcloud auth print-identity-token)

curl -H "Authorization: Bearer $TOKEN" \
  -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  https://your-service.run.app/process-zip
```

## 📝 Logging & Monitoring

### View Logs

```bash
# Tail logs in real-time
gcloud run services logs tail face-detection-service --region us-central1

# View recent logs
gcloud run services logs read face-detection-service --limit 100
```

### Monitor in Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Select your service
3. View Metrics, Logs, and Revisions

## 🛠️ Configuration

### Adjust Memory/CPU

Edit `deploy.sh`:

```bash
MEMORY="8Gi"  # Increase from 4Gi
CPU="4"       # Increase from 2
```

### Adjust Workers

When calling the API:

```bash
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  -F "max_workers=8" \  # Increase from 4
  https://your-service.run.app/process-zip
```

## 🔄 Updates & Maintenance

### Redeploy

```bash
# Make changes to app.py, then
./deploy.sh
```

### Rollback

```bash
# View revisions
gcloud run revisions list --service face-detection-service

# Rollback to previous revision
gcloud run services update-traffic face-detection-service \
    --to-revisions REVISION_NAME=100
```

## 🧹 Cleanup

```bash
# Delete service
gcloud run services delete face-detection-service --region us-central1

# Delete storage bucket
gsutil -m rm -r gs://your-bucket

# Delete container images
gcloud container images delete gcr.io/PROJECT_ID/face-detection-service
```

## 🤝 Contributing

This is your internal project. To extend functionality:

1. Edit `app.py` for new endpoints
2. Update `requirements.txt` for new dependencies
3. Test locally with `./deploy-local.sh`
4. Deploy with `./deploy.sh`

## 📄 License

Same as your original project.

## 🆘 Support

- Cloud Run: https://cloud.google.com/run/docs
- InsightFace: https://github.com/deepinsight/insightface
- Google Cloud Storage: https://cloud.google.com/storage/docs

## 🎉 Next Steps

1. ✅ Follow [QUICKSTART.md](QUICKSTART.md) to deploy
2. 📖 Read [README_CLOUD_RUN.md](README_CLOUD_RUN.md) for details
3. 🔍 Learn face comparison in [FACE_COMPARISON_GUIDE.md](FACE_COMPARISON_GUIDE.md)
4. 🔄 Check [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for migration info
5. 🚀 Start processing and comparing faces!

---

**Built with ❤️ for efficient face detection at scale**

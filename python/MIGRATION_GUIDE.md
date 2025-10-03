# Migration Guide: Local to Google Cloud Run

This guide explains how your existing face detection system has been adapted for Google Cloud Run.

## What Changed

### 1. Architecture

**Before (Local):**
```
main.py → Read local files → Process → Save to local folder
```

**After (Cloud Run):**
```
Client → API Endpoint → Stream process ZIP → Upload to GCS
```

### 2. File Structure

**New Files:**
- `app.py` - Flask API application with streaming capabilities
- `Dockerfile` - Container definition for Cloud Run
- `requirements.txt` - Python dependencies (preserved versions)
- `deploy.sh` - Deployment automation script
- `deploy-local.sh` - Local testing script
- `test-endpoint.sh` - API testing script
- `example_client.py` - Python client for API
- `.dockerignore` - Docker build exclusions
- `.gcloudignore` - Cloud deployment exclusions
- `README_CLOUD_RUN.md` - Comprehensive documentation
- `MIGRATION_GUIDE.md` - This file

**Preserved:**
- `main.py` - Your original local processing script (still works!)

### 3. Core Logic Preserved

The face detection and embedding logic from `main.py` has been **completely preserved** in `app.py`:

| Feature | Original (main.py) | New (app.py) |
|---------|-------------------|--------------|
| Face model | buffalo_l | ✅ Same |
| Detection size | (640, 640) | ✅ Same |
| Embedding extraction | Yes | ✅ Same |
| Gender detection | Yes | ✅ Same |
| Similarity threshold | 0.6 | ✅ Same |
| Requirements | insightface, opencv, numpy | ✅ Same versions |

### 4. New Capabilities

✨ **Streaming Processing**: Images are processed as they're extracted from the zip file, not all at once
✨ **Cloud Storage**: Results automatically uploaded to GCS
✨ **REST API**: Access via HTTP endpoints from anywhere
✨ **Scalable**: Auto-scales based on demand
✨ **Parallel Processing**: Concurrent image processing with ThreadPoolExecutor
✨ **Production Ready**: Gunicorn server, proper logging, error handling

## How to Use Both Versions

### Local Version (main.py)

Still works as before! Perfect for local testing and development:

```bash
cd python
python main.py
```

Processes:
- Input: `all/` directory
- Reference: `ref.jpg`
- Output: `filtered/` directory

### Cloud Version (app.py)

For production workloads and large-scale processing:

```bash
# Deploy to Cloud Run
./deploy.sh

# Call the API
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  https://your-service.run.app/process-zip
```

## Code Mapping

Here's how the original functions map to the new API:

### PhotoFilter.__init__() → initialize_face_model()

**Original:**
```python
def __init__(self):
    self.app = FaceAnalysis(
        name='buffalo_l',
        root='.',
        providers=['CPUExecutionProvider']
    )
    self.app.prepare(ctx_id=0, det_size=(640, 640))
```

**New:**
```python
def initialize_face_model():
    global face_app
    if face_app is None:
        face_app = FaceAnalysis(
            name='buffalo_l',
            root='.',
            providers=['CPUExecutionProvider']
        )
        face_app.prepare(ctx_id=0, det_size=(640, 640))
    return face_app
```

**Changes:** Model is initialized once globally and reused across requests

### PhotoFilter.get_face_features() → get_face_embeddings()

**Original:**
```python
def get_face_features(self, image):
    faces = self.app.get(image)
    return [(face.embedding, face.gender) for face in faces]
```

**New:**
```python
def get_face_embeddings(image):
    app = initialize_face_model()
    faces = app.get(image)
    return [(face.embedding, face.gender, face.bbox) for face in faces]
```

**Changes:** 
- Now a standalone function
- Added bbox (bounding box) to output

### PhotoFilter.process_photo() → process_image_from_zip()

**Original:**
```python
def process_photo(self, photo_path, ref_embedding, ref_gender, output_path):
    img = cv2.imread(str(photo_path))
    face_features = self.get_face_features(img)
    # ... comparison logic ...
    shutil.copy2(photo_path, output_path / photo_path.name)
```

**New:**
```python
def process_image_from_zip(image_data, image_name, bucket_name, base_path):
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    face_features = get_face_embeddings(img)
    # ... process and upload to GCS ...
    upload_to_gcs(bucket_name, image_path, image_data)
```

**Changes:**
- Reads from memory (bytes) instead of file path
- Uploads to GCS instead of local file system
- Extracts and saves embeddings as JSON

### PhotoFilter.process_photos() → stream_process_zip()

**Original:**
```python
def process_photos(self, input_folder, output_folder, reference_photo_path):
    photo_files = list(Path(input_folder).glob("*.jpg"))
    with ProcessPoolExecutor() as executor:
        # ... process files ...
```

**New:**
```python
def stream_process_zip(zip_file_data, bucket_name, base_path, max_workers=4):
    with zipfile.ZipFile(io.BytesIO(zip_file_data)) as zf:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for image_file in image_files:
                image_data = zf.read(image_file)
                # ... process in parallel ...
```

**Changes:**
- Processes zip file instead of directory
- Streams images from zip file memory
- Uses ThreadPoolExecutor instead of ProcessPoolExecutor (better for I/O)
- Parallel upload to GCS

## Data Format Changes

### Input

**Before:**
- Directory of image files on local disk

**After:**
- ZIP file uploaded via HTTP POST request

### Output

**Before:**
```
filtered/
  ├── photo1.jpg
  ├── photo2.jpg
  └── ...
```

**After:**
```
gs://bucket/base_path/
  ├── images/
  │   ├── photo1.jpg
  │   └── photo2.jpg
  ├── embeddings/
  │   ├── photo1.json
  │   └── photo2.json
  └── summary.json
```

**Embedding JSON:**
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

## Performance Comparison

| Aspect | Local (main.py) | Cloud Run (app.py) |
|--------|----------------|-------------------|
| Processing | Sequential with multiprocessing | Parallel with threading |
| Memory | All files in memory | Streaming from zip |
| Scale | Limited by single machine | Auto-scales to 10+ instances |
| Storage | Local disk | Cloud Storage |
| Availability | Manual start | Always available |
| Cost | Fixed (your machine) | Pay per use |

## Migration Steps

### Step 1: Test Locally

```bash
# Build and run locally
./deploy-local.sh

# Test with a small zip file
./test-endpoint.sh http://localhost:8080 test.zip test-bucket
```

### Step 2: Set Up GCP

```bash
# Install gcloud CLI
# Follow: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud auth application-default login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Create storage bucket
gsutil mb gs://your-bucket-name/
```

### Step 3: Deploy to Cloud Run

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export SERVICE_NAME="face-detection-service"
export REGION="us-central1"

# Deploy
./deploy.sh
```

### Step 4: Test Production

```bash
# Get service URL from deploy output
SERVICE_URL="https://face-detection-service-xxxx.run.app"

# Test with real data
./test-endpoint.sh $SERVICE_URL images.zip your-bucket-name
```

### Step 5: Use Python Client

```python
from example_client import FaceDetectionClient

client = FaceDetectionClient("https://your-service.run.app")

# Check health
health = client.health_check()

# Process images
result = client.process_zip(
    "images.zip",
    "my-bucket",
    base_path="batch-001",
    max_workers=4
)

# Download embeddings
embeddings = client.download_embeddings(
    "my-bucket",
    "batch-001",
    output_dir="./embeddings"
)
```

## Troubleshooting

### Issue: "Model not found"

The model is automatically downloaded during Docker build. If you see this error:

```bash
# Rebuild with no cache
docker build --no-cache -t face-detection-service .
```

### Issue: "Out of memory"

Increase memory allocation:

```bash
# Edit deploy.sh
MEMORY="8Gi"  # Instead of 4Gi

# Redeploy
./deploy.sh
```

### Issue: "GCS permission denied"

Grant storage permissions:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"
```

### Issue: "Request timeout"

Increase timeout or reduce batch size:

```bash
# Edit deploy.sh
TIMEOUT="3600"  # Max allowed

# Or reduce max_workers when calling API
curl -X POST \
  -F "zip_file=@images.zip" \
  -F "bucket_name=my-bucket" \
  -F "max_workers=2" \  # Reduced from 4
  https://your-service.run.app/process-zip
```

## Best Practices

### 1. Start Small

Test with a small zip file (10-50 images) before processing thousands.

### 2. Monitor Costs

- Enable billing alerts in GCP Console
- Use `--min-instances=0` to scale to zero when idle
- Archive old data with GCS lifecycle policies

### 3. Optimize Performance

- Use `max_workers=4` for balanced performance
- Split very large zip files into batches
- Process during off-peak hours for lower costs

### 4. Security

- Use authenticated endpoints for production
- Implement API keys or OAuth
- Use VPC for internal-only access

### 5. Monitoring

```bash
# View logs
gcloud run services logs tail face-detection-service --region us-central1

# View metrics in console
# Navigate to Cloud Run → Your Service → Metrics
```

## Next Steps

1. ✅ Deploy and test with sample data
2. ✅ Verify embeddings in GCS
3. ✅ Implement face comparison logic (compare with reference face) - **DONE!**
4. 🔄 Add webhook notifications
5. 🔄 Implement batch processing UI
6. 🔄 Add face clustering algorithms

## Support

- Cloud Run docs: https://cloud.google.com/run/docs
- InsightFace docs: https://github.com/deepinsight/insightface
- GCS docs: https://cloud.google.com/storage/docs

## Summary

Your face detection system has been successfully modernized for cloud deployment while **preserving all core functionality**. You now have:

- ✅ Original local script (still works)
- ✅ Cloud-native API service
- ✅ Streaming processing for large datasets
- ✅ Automatic scaling
- ✅ Cloud storage integration
- ✅ Production-ready deployment

The migration is **backward compatible** - you can continue using `main.py` locally while leveraging the cloud service for production workloads!

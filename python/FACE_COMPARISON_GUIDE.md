# Face Comparison Guide

This guide explains how to use the face comparison endpoint to find matching faces in your processed images.

## Overview

The face comparison endpoint allows you to:
1. Upload a reference image with a face
2. Compare it against all previously processed images
3. Get back a list of matching faces sorted by similarity score
4. Optionally filter by gender and limit the number of results

## How It Works

```
Reference Image → Extract Face Embedding → Compare with Stored Embeddings
                                                    ↓
                                          Sort by Similarity Score
                                                    ↓
                                            Return Matches
```

The comparison uses the same logic from your original `main.py`:
- **Similarity Calculation**: Cosine similarity via dot product
- **Default Threshold**: 0.6 (same as original)
- **Gender Matching**: Optional gender filter (enabled by default)
- **Sorted Results**: Returns matches sorted by similarity (highest first)

## API Endpoint

**POST** `/compare-faces`

Accepts two modes:
1. **File Upload Mode**: Upload reference image as multipart/form-data
2. **GCS Path Mode**: Provide GCS path to reference image as JSON

## Usage Examples

### 1. Using cURL (File Upload)

```bash
curl -X POST \
  -F "reference_image=@ref.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  -F "similarity_threshold=0.6" \
  -F "gender_match=true" \
  -F "return_top_n=10" \
  https://your-service.run.app/compare-faces
```

### 2. Using cURL (GCS Path)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "reference_image_gcs_path": "batch-001/images/person1.jpg",
    "bucket_name": "my-bucket",
    "base_path": "batch-001",
    "similarity_threshold": 0.6,
    "gender_match": true,
    "return_top_n": 10
  }' \
  https://your-service.run.app/compare-faces
```

### 3. Using Python Client

```python
from example_client import FaceDetectionClient

client = FaceDetectionClient("https://your-service.run.app")

# Compare with local reference image
result = client.compare_faces(
    reference_image_path="ref.jpg",
    bucket_name="my-bucket",
    base_path="batch-001",
    similarity_threshold=0.6,
    gender_match=True,
    return_top_n=10
)

# Print results
print(f"Found {result['matches_found']} matches")
for match in result['matches']:
    print(f"{match['image_name']}: {match['similarity']:.4f}")
```

### 4. Using Command Line

```bash
python example_client.py \
  --url https://your-service.run.app \
  --action compare \
  --reference-image ref.jpg \
  --bucket my-bucket \
  --base-path batch-001 \
  --similarity-threshold 0.6 \
  --top-n 10
```

### 5. Using Test Script

```bash
./test-compare.sh https://your-service.run.app ref.jpg my-bucket batch-001
```

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `reference_image` (file upload) or `reference_image_gcs_path` (JSON) | file/string | Reference image with face to find |
| `bucket_name` | string | GCS bucket name where embeddings are stored |
| `base_path` | string | Base path containing the embeddings |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `similarity_threshold` | float | 0.6 | Minimum similarity score (0.0 to 1.0) |
| `gender_match` | boolean | true | Require gender to match reference |
| `return_top_n` | integer | null | Limit results to top N matches |

## Response Format

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
    },
    {
      "image_name": "photo5.jpg",
      "image_path": "batch-001/images/photo5.jpg",
      "face_index": 1,
      "similarity": 0.7891,
      "gender": "male",
      "bbox": [150, 180, 350, 380]
    }
  ]
}
```

### Response Fields

- `success`: Boolean indicating success
- `reference_gender`: Detected gender of reference face
- `similarity_threshold`: Threshold used for matching
- `gender_match_required`: Whether gender matching was required
- `total_images_checked`: Number of images searched
- `total_faces_checked`: Total number of faces compared
- `matches_found`: Number of matches found
- `matches`: Array of matching faces (sorted by similarity, highest first)

### Match Object

Each match contains:
- `image_name`: Original filename
- `image_path`: GCS path to the image
- `face_index`: Index of the face in the image (0-based)
- `similarity`: Similarity score (0.0 to 1.0)
- `gender`: Detected gender ("male" or "female")
- `bbox`: Bounding box coordinates [x1, y1, x2, y2]

## Complete Workflow Example

### Step 1: Process Images

```bash
# Upload and process a zip file
curl -X POST \
  -F "zip_file=@photos.zip" \
  -F "bucket_name=my-bucket" \
  -F "base_path=family-reunion-2024" \
  https://your-service.run.app/process-zip
```

### Step 2: Find Matches

```bash
# Find all photos containing a specific person
curl -X POST \
  -F "reference_image=@john.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=family-reunion-2024" \
  -F "similarity_threshold=0.65" \
  https://your-service.run.app/compare-faces
```

### Step 3: Download Matching Images

```python
from google.cloud import storage
import json

# Parse the comparison results
with open('matches.json') as f:
    results = json.load(f)

# Download matching images
client = storage.Client()
bucket = client.bucket('my-bucket')

for match in results['matches']:
    blob = bucket.blob(match['image_path'])
    filename = f"match_{match['similarity']:.4f}_{match['image_name']}"
    blob.download_to_filename(f"matches/{filename}")
    print(f"Downloaded: {filename}")
```

## Similarity Threshold Guide

The similarity score ranges from 0.0 (no similarity) to 1.0 (identical).

| Threshold | Interpretation | Use Case |
|-----------|----------------|----------|
| 0.3 - 0.4 | Very loose matching | Find anyone with similar features |
| 0.5 - 0.6 | Moderate matching | General face finding (default) |
| 0.7 - 0.8 | Strict matching | High confidence matches |
| 0.9+ | Very strict | Only near-identical faces |

**Recommended**: Start with 0.6 (default) and adjust based on results.

## Gender Matching

Gender matching filters results to only include faces with the same detected gender as the reference.

**When to use:**
- ✅ Finding a specific person
- ✅ When reference clearly shows gender
- ✅ Reducing false positives

**When to disable:**
- ❌ Reference gender ambiguous
- ❌ Want to find similar faces regardless of gender
- ❌ Gender detection might be unreliable

```bash
# Disable gender matching
curl -X POST \
  -F "reference_image=@ref.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  -F "gender_match=false" \
  https://your-service.run.app/compare-faces
```

## Performance Tips

### 1. Use Top-N Limiting

For large datasets, limit results to top N matches:

```bash
-F "return_top_n=50"  # Only return top 50 matches
```

### 2. Increase Threshold

Higher thresholds reduce the number of results:

```bash
-F "similarity_threshold=0.7"  # Stricter matching
```

### 3. Process in Batches

For very large datasets (10,000+ images), process in separate batches and compare separately.

## Troubleshooting

### No Matches Found

**Possible causes:**
- Similarity threshold too high → Lower it to 0.5
- Gender matching too strict → Disable with `gender_match=false`
- No faces detected in reference → Check reference image has clear face
- Wrong base_path → Verify embeddings exist at that path

**Solution:**
```bash
# More lenient search
curl -X POST \
  -F "reference_image=@ref.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  -F "similarity_threshold=0.4" \
  -F "gender_match=false" \
  https://your-service.run.app/compare-faces
```

### "No face detected in reference image"

**Causes:**
- Face too small or blurry
- Face partially obscured
- Poor lighting
- Extreme angle

**Solution:**
- Use a clear, well-lit reference photo
- Face should be at least 100x100 pixels
- Front-facing or slight angle works best

### Request Timeout

For very large datasets (10,000+ embeddings), comparison might take time.

**Solution:**
- Use `return_top_n` to limit results
- Process in batches with separate base_paths
- Increase client timeout:

```python
# Python client with longer timeout
result = client.compare_faces(
    reference_image_path="ref.jpg",
    bucket_name="my-bucket",
    base_path="batch-001"
)  # Already has 600s timeout
```

## Advanced Usage

### Compare Multiple References

```python
from example_client import FaceDetectionClient

client = FaceDetectionClient("https://your-service.run.app")

references = ["person1.jpg", "person2.jpg", "person3.jpg"]
all_matches = {}

for ref in references:
    result = client.compare_faces(
        reference_image_path=ref,
        bucket_name="my-bucket",
        base_path="batch-001",
        return_top_n=20
    )
    all_matches[ref] = result['matches']

# Now you have matches for each reference person
```

### Create a Face Gallery

```python
import os
from google.cloud import storage

def create_face_gallery(matches, output_dir="gallery"):
    """Download and organize matching faces"""
    os.makedirs(output_dir, exist_ok=True)
    
    client = storage.Client()
    bucket = client.bucket('my-bucket')
    
    for i, match in enumerate(matches, 1):
        blob = bucket.blob(match['image_path'])
        filename = f"{i:03d}_sim{match['similarity']:.4f}_{match['image_name']}"
        blob.download_to_filename(f"{output_dir}/{filename}")

# Use it
result = client.compare_faces(...)
create_face_gallery(result['matches'][:50])
```

### Export Matches to CSV

```python
import csv

def export_matches_to_csv(matches, filename="matches.csv"):
    """Export matches to CSV for analysis"""
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Image Name', 'Similarity', 'Gender', 'Image Path'])
        
        for match in matches:
            writer.writerow([
                match['image_name'],
                match['similarity'],
                match['gender'],
                match['image_path']
            ])

# Use it
result = client.compare_faces(...)
export_matches_to_csv(result['matches'])
```

## Cost Considerations

Face comparison is generally fast and inexpensive:

- **Compute**: ~0.01-0.1 seconds per embedding comparison
- **Storage Reads**: One read per embedding file
- **Typical Cost**: ~$0.001 per 100 comparisons

**Example**: Comparing against 1,000 images costs < $0.01

## Security

For production deployments:

```bash
# Require authentication
gcloud run deploy face-detection-service \
    --no-allow-unauthenticated \
    --region us-central1

# Make authenticated request
TOKEN=$(gcloud auth print-identity-token)

curl -H "Authorization: Bearer $TOKEN" \
  -X POST \
  -F "reference_image=@ref.jpg" \
  -F "bucket_name=my-bucket" \
  -F "base_path=batch-001" \
  https://your-service.run.app/compare-faces
```

## Next Steps

1. ✅ Process your images with `/process-zip`
2. ✅ Compare faces with `/compare-faces`
3. 🔄 Download matching images
4. 🔄 Build a UI for face search
5. 🔄 Implement face clustering for grouping similar faces

## Support

- Main docs: `README_CLOUD_RUN.md`
- Migration guide: `MIGRATION_GUIDE.md`
- Quick start: `QUICKSTART.md`

---

**Happy face finding! 🔍👤**

#!/bin/bash

# Script to test the face comparison endpoint
# Usage: ./test-compare.sh [service-url] [reference-image] [bucket-name] [base-path]

SERVICE_URL="${1:-http://localhost:8080}"
REFERENCE_IMAGE="${2:-ref.jpg}"
BUCKET_NAME="${3:-your-bucket-name}"
BASE_PATH="${4:-face-processing-20251003}"

echo "======================================"
echo "Testing Face Comparison Endpoint"
echo "======================================"
echo "Service URL: $SERVICE_URL"
echo "Reference Image: $REFERENCE_IMAGE"
echo "Bucket name: $BUCKET_NAME"
echo "Base path: $BASE_PATH"
echo "======================================"

# Check if reference image exists
if [ ! -f "$REFERENCE_IMAGE" ]; then
    echo "Error: Reference image '$REFERENCE_IMAGE' not found"
    exit 1
fi

echo ""
echo "Comparing faces with similarity threshold 0.6 and gender matching enabled..."
echo ""

# Test with file upload
curl -X POST \
    -F "reference_image=@$REFERENCE_IMAGE" \
    -F "bucket_name=$BUCKET_NAME" \
    -F "base_path=$BASE_PATH" \
    -F "similarity_threshold=0.6" \
    -F "gender_match=true" \
    -F "return_top_n=10" \
    "$SERVICE_URL/compare-faces" | python3 -m json.tool

echo ""
echo "======================================"
echo "Comparison test completed!"
echo "======================================"

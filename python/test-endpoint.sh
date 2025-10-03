#!/bin/bash

# Script to test the face detection endpoint
# Usage: ./test-endpoint.sh [service-url] [zip-file] [bucket-name]

SERVICE_URL="${1:-http://localhost:8080}"
ZIP_FILE="${2:-images.zip}"
BUCKET_NAME="${3:-your-bucket-name}"

echo "======================================"
echo "Testing Face Detection Service"
echo "======================================"
echo "Service URL: $SERVICE_URL"
echo "Zip file: $ZIP_FILE"
echo "Bucket name: $BUCKET_NAME"
echo "======================================"

# Check if zip file exists
if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: Zip file '$ZIP_FILE' not found"
    exit 1
fi

# Test health endpoint
echo ""
echo "1. Testing health endpoint..."
curl -s "$SERVICE_URL/health" | python3 -m json.tool

# Test process-zip endpoint
echo ""
echo "2. Testing process-zip endpoint..."
echo "This may take a while depending on the number of images..."
curl -X POST \
    -F "zip_file=@$ZIP_FILE" \
    -F "bucket_name=$BUCKET_NAME" \
    -F "base_path=test-run/$(date +%Y%m%d_%H%M%S)" \
    "$SERVICE_URL/process-zip" | python3 -m json.tool

echo ""
echo "======================================"
echo "Test completed!"
echo "======================================"

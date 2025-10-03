#!/bin/bash

# Local deployment script for testing
# This script builds and runs the Docker container locally

set -e

SERVICE_NAME="face-detection-service"
PORT=8080

echo "======================================"
echo "Building Docker image locally..."
echo "======================================"

# Build the Docker image
docker build -t $SERVICE_NAME .

echo "======================================"
echo "Starting container..."
echo "======================================"

# Run the container
# Mount Google Cloud credentials if they exist
if [ -f "$HOME/.config/gcloud/application_default_credentials.json" ]; then
    echo "Using Google Cloud credentials from: $HOME/.config/gcloud/application_default_credentials.json"
    docker run -p $PORT:$PORT \
        -e PORT=$PORT \
        -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/keys/credentials.json \
        -v $HOME/.config/gcloud/application_default_credentials.json:/tmp/keys/credentials.json:ro \
        $SERVICE_NAME
else
    echo "Warning: No Google Cloud credentials found"
    echo "The service will run but GCS operations may fail"
    docker run -p $PORT:$PORT \
        -e PORT=$PORT \
        $SERVICE_NAME
fi

echo "======================================"
echo "Service running at: http://localhost:$PORT"
echo "Health check: curl http://localhost:$PORT/health"
echo "======================================"

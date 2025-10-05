#!/bin/bash

# Local deployment script for testing
# This script builds and runs the Docker container locally
# Usage: ./deploy-local.sh [--no-cache]

set -e

SERVICE_NAME="find-photos-of-me-service"
PORT=8000

# Check for --no-cache flag
CACHE_FLAG=""
if [[ "$1" == "--no-cache" ]]; then
    CACHE_FLAG="--no-cache"
    echo "Building without cache..."
fi

echo "======================================"
echo "Building Docker image locally..."
echo "======================================"

# Build the Docker image
docker build $CACHE_FLAG -t $SERVICE_NAME .

echo "======================================"
echo "Starting container..."
echo "======================================"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    echo "Please create a .env file with the following variables:"
    echo "  R2_ACCOUNT_ID=your_account_id"
    echo "  R2_ACCESS_KEY_ID=your_access_key"
    echo "  R2_SECRET_ACCESS_KEY=your_secret_key"
    echo "  R2_BUCKET_NAME=your_bucket_name"
    echo "  CONVEX_URL=your_convex_url"
    echo "  CORS_ORIGINS=* (optional)"
    exit 1
fi

# Load environment variables from .env file
export $(cat .env | grep -v '^#' | xargs)

# Verify required environment variables
MISSING_VARS=()
[ -z "$R2_ACCOUNT_ID" ] && MISSING_VARS+=("R2_ACCOUNT_ID")
[ -z "$R2_ACCESS_KEY_ID" ] && MISSING_VARS+=("R2_ACCESS_KEY_ID")
[ -z "$R2_SECRET_ACCESS_KEY" ] && MISSING_VARS+=("R2_SECRET_ACCESS_KEY")
[ -z "$R2_BUCKET_NAME" ] && MISSING_VARS+=("R2_BUCKET_NAME")
[ -z "$CONVEX_URL" ] && MISSING_VARS+=("CONVEX_URL")

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "ERROR: Missing required environment variables:"
    printf '  %s\n' "${MISSING_VARS[@]}"
    exit 1
fi

echo "Environment variables loaded from .env"
echo "Starting container on port $PORT..."

# Stop and remove existing container if running
if [ "$(docker ps -aq -f name=$SERVICE_NAME)" ]; then
    echo "Stopping existing container..."
    docker stop $SERVICE_NAME 2>/dev/null || true
    docker rm $SERVICE_NAME 2>/dev/null || true
fi

# Create named volume for models if it doesn't exist
if [ -z "$(docker volume ls -q -f name=insightface-models)" ]; then
    echo "Creating Docker volume for InsightFace models..."
    docker volume create insightface-models
fi

# Run the container with environment variables and volume mount
docker run -d \
    --name $SERVICE_NAME \
    -p $PORT:$PORT \
    -v insightface-models:/app/models \
    -e PORT=$PORT \
    -e R2_ACCOUNT_ID="$R2_ACCOUNT_ID" \
    -e R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e R2_BUCKET_NAME="$R2_BUCKET_NAME" \
    -e CONVEX_URL="$CONVEX_URL" \
    -e CORS_ORIGINS="${CORS_ORIGINS:-*}" \
    $SERVICE_NAME

# Wait a moment for container to start
sleep 2

# Check if container is running
if [ "$(docker ps -q -f name=$SERVICE_NAME)" ]; then
    echo "======================================"
    echo "✓ Service running at: http://localhost:$PORT"
    echo "Health check: curl http://localhost:$PORT/health"
    echo ""
    echo "View logs:    docker logs -f $SERVICE_NAME"
    echo "Stop service: docker stop $SERVICE_NAME"
    echo "======================================"
else
    echo "======================================"
    echo "✗ Container failed to start"
    echo "Check logs with: docker logs $SERVICE_NAME"
    echo "======================================"
    exit 1
fi

#!/bin/bash

# Deployment script for Google Cloud Run
# This script builds and deploys the face detection service to Google Cloud Run

set -e

# Configuration - UPDATE THESE VALUES
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
SERVICE_NAME="${SERVICE_NAME:-face-detection-service}"
REGION="${REGION:-us-central1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
MEMORY="${MEMORY:-4Gi}"
CPU="${CPU:-2}"
TIMEOUT="${TIMEOUT:-3600}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"

echo "======================================"
echo "Deploying Face Detection Service"
echo "======================================"
echo "Project ID: $PROJECT_ID"
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"
echo "Memory: $MEMORY"
echo "CPU: $CPU"
echo "Timeout: ${TIMEOUT}s"
echo "======================================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the project
echo "Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com

# Build the container image using Cloud Build
echo "Building container image..."
gcloud builds submit --tag $IMAGE_NAME

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --memory $MEMORY \
    --cpu $CPU \
    --timeout $TIMEOUT \
    --max-instances $MAX_INSTANCES \
    --min-instances $MIN_INSTANCES \
    --allow-unauthenticated \
    --set-env-vars="PYTHONUNBUFFERED=1"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo "======================================"
echo "Deployment completed successfully!"
echo "======================================"
echo "Service URL: $SERVICE_URL"
echo ""
echo "Health check: curl $SERVICE_URL/health"
echo ""
echo "Example usage:"
echo "curl -X POST -F 'zip_file=@images.zip' -F 'bucket_name=my-bucket' $SERVICE_URL/process-zip"
echo "======================================"

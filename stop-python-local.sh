#!/bin/bash

# Stop local Python ML service deployment
# Usage: ./stop-python-local.sh

SERVICE_NAME="find-photos-of-me-service"

echo "======================================"
echo "Stopping Python ML service..."
echo "======================================"

if [ "$(docker ps -q -f name=$SERVICE_NAME)" ]; then
    docker stop $SERVICE_NAME
    docker rm $SERVICE_NAME
    echo "✓ Service stopped and removed"
else
    echo "No running container found"
    
    # Check if stopped container exists
    if [ "$(docker ps -aq -f name=$SERVICE_NAME)" ]; then
        docker rm $SERVICE_NAME
        echo "✓ Removed stopped container"
    fi
fi

echo "======================================"

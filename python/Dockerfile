FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Runtime dependencies for OpenCV and InsightFace
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    # Build tools required for compiling InsightFace C++ extensions
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directory for InsightFace models
# This directory should be mounted as a volume to persist models across restarts
RUN mkdir -p /app/models

# Expose port (default 8000, can be overridden with PORT env var)
EXPOSE 8000

# Set default port
ENV PORT=8000

# Run the application using JSON array format (prevents signal handling issues)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

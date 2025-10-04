"""FastAPI application for photo processing service."""

import os
import sys

# Add current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from endpoints.upload_collection import router as upload_router
from endpoints.search_photos import router as search_router

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Find Photos of Me - Processing Service",
    description="Face recognition service for processing and searching photos",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload_router, prefix="/api", tags=["upload"])
app.include_router(search_router, prefix="/api", tags=["search"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "find-photos-of-me-processing"
    }


@app.get("/health")
async def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "healthy",
        "services": {
            "r2": bool(os.getenv("R2_ACCOUNT_ID")),
            "convex": bool(os.getenv("CONVEX_URL"))
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

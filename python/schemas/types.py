"""Type definitions for API requests and responses."""

from pydantic import BaseModel
from typing import Optional


class UploadResponse(BaseModel):
    """Response for upload collection endpoint."""
    success: bool
    message: str
    images_processed: int


class SearchResponse(BaseModel):
    """Response for search photos endpoint."""
    success: bool
    message: str
    search_request_id: str


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = False
    error: str
    detail: Optional[str] = None


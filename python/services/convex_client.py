"""Convex client service for database operations."""

import os
from convex import ConvexClient
from datetime import datetime
from typing import Optional, Any


class ConvexService:
    """Manages interactions with Convex database."""
    
    def __init__(self):
        """Initialize Convex client."""
        convex_url = os.getenv('CONVEX_URL')
        if not convex_url:
            raise ValueError("Missing CONVEX_URL environment variable")
        
        self.client = ConvexClient(convex_url)
        print(f"[{self._get_time()}] Convex client initialized")
    
    def _get_time(self) -> str:
        """Get current time as formatted string."""
        return datetime.now().strftime("%H:%M:%S")
    
    def get_collection(self, collection_id: str) -> Optional[dict]:
        """Get collection by ID.
        
        Args:
            collection_id: Collection ID
            
        Returns:
            Collection data or None if not found
        """
        try:
            result = self.client.query("collections:get", {"id": collection_id})
            return result
        except Exception as e:
            print(f"[{self._get_time()}] Error getting collection {collection_id}: {e}")
            return None
    
    def update_collection_status(
        self, 
        collection_id: str, 
        status: str,
        images_count: Optional[int] = None
    ) -> bool:
        """Update collection status and optionally image count.
        
        Args:
            collection_id: Collection ID
            status: New status (not_started, processing, complete)
            images_count: Optional image count to update
            
        Returns:
            True if successful, False otherwise
        """
        try:
            args = {
                "id": collection_id,
                "status": status
            }
            if images_count is not None:
                args["imagesCount"] = images_count
            
            self.client.mutation("collections:updateStatus", args)
            print(f"[{self._get_time()}] Updated collection {collection_id} status to {status}")
            return True
        except Exception as e:
            print(f"[{self._get_time()}] Error updating collection: {e}")
            return False
    
    def increment_collection_images(self, collection_id: str, increment: int = 1) -> bool:
        """Increment collection image count.
        
        Args:
            collection_id: Collection ID
            increment: Amount to increment by
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.mutation("collections:incrementImages", {
                "id": collection_id,
                "increment": increment
            })
            return True
        except Exception as e:
            print(f"[{self._get_time()}] Error incrementing collection images: {e}")
            return False
    
    def get_search_request(self, search_request_id: str) -> Optional[dict]:
        """Get search request by ID.
        
        Args:
            search_request_id: Search request ID
            
        Returns:
            Search request data or None if not found
        """
        try:
            result = self.client.query("searchRequests:get", {"id": search_request_id})
            return result
        except Exception as e:
            print(f"[{self._get_time()}] Error getting search request {search_request_id}: {e}")
            return None
    
    def update_search_request(
        self,
        search_request_id: str,
        status: str,
        images_found: Optional[list] = None,
        total_images: Optional[int] = None,
        processed_images: Optional[int] = None
    ) -> bool:
        """Update search request with progress and results.
        
        Args:
            search_request_id: Search request ID
            status: Status (processing, complete, error)
            images_found: List of image paths found
            total_images: Total number of images to process
            processed_images: Number of images processed so far
            
        Returns:
            True if successful, False otherwise
        """
        try:
            args = {
                "id": search_request_id,
                "status": status
            }
            if images_found is not None:
                args["imagesFound"] = images_found
            if total_images is not None:
                args["totalImages"] = total_images
            if processed_images is not None:
                args["processedImages"] = processed_images
            
            self.client.mutation("searchRequests:update", args)
            print(f"[{self._get_time()}] Updated search request {search_request_id}")
            return True
        except Exception as e:
            print(f"[{self._get_time()}] Error updating search request: {e}")
            return False


"""R2 Storage service for managing Cloudflare R2 operations."""

import os
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
from typing import Optional


class R2StorageService:
    """Manages interactions with Cloudflare R2 storage."""
    
    def __init__(self):
        """Initialize R2 storage service with credentials from environment."""
        self.account_id = os.getenv('R2_ACCOUNT_ID')
        self.access_key_id = os.getenv('R2_ACCESS_KEY_ID')
        self.secret_access_key = os.getenv('R2_SECRET_ACCESS_KEY')
        self.bucket_name = os.getenv('R2_BUCKET_NAME')
        
        if not all([self.account_id, self.access_key_id, self.secret_access_key, self.bucket_name]):
            raise ValueError("Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME")
        
        endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
        
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name='auto'
        )
        
        print(f"[{self._get_time()}] R2 storage initialized for bucket: {self.bucket_name}")
    
    def _get_time(self) -> str:
        """Get current time as formatted string."""
        return datetime.now().strftime("%H:%M:%S")
    
    def upload_file(self, file_data: bytes, key: str, content_type: str = 'image/jpeg') -> bool:
        """Upload file data to R2.
        
        Args:
            file_data: Binary file data
            key: Object key/path in R2
            content_type: MIME type of the file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_data,
                ContentType=content_type
            )
            print(f"[{self._get_time()}] Uploaded: {key}")
            return True
        except ClientError as e:
            print(f"[{self._get_time()}] Error uploading {key}: {e}")
            return False
    
    def download_file(self, key: str) -> Optional[bytes]:
        """Download file from R2 to memory.
        
        Args:
            key: Object key/path in R2
            
        Returns:
            File data as bytes, or None if error
        """
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            return response['Body'].read()
        except ClientError as e:
            print(f"[{self._get_time()}] Error downloading {key}: {e}")
            return None
    
    def list_objects(self, prefix: str) -> list:
        """List all objects in bucket with given prefix.
        
        Args:
            prefix: Prefix to filter objects
            
        Returns:
            List of object metadata dictionaries
        """
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            
            objects = []
            for page in pages:
                if 'Contents' in page:
                    objects.extend(page['Contents'])
            
            return objects
        except ClientError as e:
            print(f"[{self._get_time()}] Error listing objects with prefix {prefix}: {e}")
            return []
    
    def delete_file(self, key: str) -> bool:
        """Delete a file from R2.
        
        Args:
            key: Object key/path in R2
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            print(f"[{self._get_time()}] Deleted: {key}")
            return True
        except ClientError as e:
            print(f"[{self._get_time()}] Error deleting {key}: {e}")
            return False

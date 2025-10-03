"""
Example client for interacting with the Face Detection Service
"""

import requests
import json
from pathlib import Path
import argparse

class FaceDetectionClient:
    def __init__(self, service_url):
        """
        Initialize the client
        
        Args:
            service_url: The URL of the deployed Cloud Run service
        """
        self.service_url = service_url.rstrip('/')
        
    def health_check(self):
        """Check if the service is healthy"""
        try:
            response = requests.get(f"{self.service_url}/health")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Health check failed: {e}")
            return None
    
    def process_zip(self, zip_file_path, bucket_name, base_path=None, max_workers=4):
        """
        Upload and process a zip file
        
        Args:
            zip_file_path: Path to the zip file
            bucket_name: GCS bucket name
            base_path: Optional base path in bucket
            max_workers: Number of parallel workers
            
        Returns:
            Response JSON or None if failed
        """
        zip_path = Path(zip_file_path)
        
        if not zip_path.exists():
            print(f"Error: Zip file not found: {zip_file_path}")
            return None
        
        print(f"Uploading {zip_path.name} ({zip_path.stat().st_size / 1024 / 1024:.2f} MB)...")
        
        try:
            with open(zip_path, 'rb') as f:
                files = {'zip_file': (zip_path.name, f, 'application/zip')}
                data = {
                    'bucket_name': bucket_name,
                    'max_workers': str(max_workers)
                }
                
                if base_path:
                    data['base_path'] = base_path
                
                response = requests.post(
                    f"{self.service_url}/process-zip",
                    files=files,
                    data=data,
                    timeout=3600  # 1 hour timeout
                )
                
                response.raise_for_status()
                return response.json()
                
        except requests.exceptions.Timeout:
            print("Error: Request timed out. The zip file might be too large.")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            return None
    
    def download_embeddings(self, bucket_name, base_path, output_dir='.'):
        """
        Download embeddings from GCS
        
        Note: This requires google-cloud-storage to be installed and
        proper authentication to be set up locally
        
        Args:
            bucket_name: GCS bucket name
            base_path: Base path in bucket
            output_dir: Local directory to save embeddings
        """
        try:
            from google.cloud import storage
            
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            # List all embeddings
            blobs = bucket.list_blobs(prefix=f"{base_path}/embeddings/")
            
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            embeddings = []
            for blob in blobs:
                if blob.name.endswith('.json'):
                    # Download and parse
                    content = blob.download_as_text()
                    embedding_data = json.loads(content)
                    embeddings.append(embedding_data)
                    
                    # Save locally
                    filename = Path(blob.name).name
                    local_path = output_path / filename
                    with open(local_path, 'w') as f:
                        json.dump(embedding_data, f, indent=2)
                    
                    print(f"Downloaded: {filename}")
            
            return embeddings
            
        except ImportError:
            print("Error: google-cloud-storage not installed")
            print("Install with: pip install google-cloud-storage")
            return None
        except Exception as e:
            print(f"Error downloading embeddings: {e}")
            return None

def main():
    parser = argparse.ArgumentParser(description='Face Detection Service Client')
    parser.add_argument('--url', required=True, help='Service URL')
    parser.add_argument('--action', required=True, choices=['health', 'process', 'download'],
                       help='Action to perform')
    parser.add_argument('--zip-file', help='Path to zip file (for process action)')
    parser.add_argument('--bucket', help='GCS bucket name')
    parser.add_argument('--base-path', help='Base path in bucket')
    parser.add_argument('--max-workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--output-dir', default='embeddings', help='Output directory for downloads')
    
    args = parser.parse_args()
    
    client = FaceDetectionClient(args.url)
    
    if args.action == 'health':
        result = client.health_check()
        if result:
            print(json.dumps(result, indent=2))
        else:
            print("Service is not healthy")
            
    elif args.action == 'process':
        if not args.zip_file or not args.bucket:
            print("Error: --zip-file and --bucket are required for process action")
            return
        
        result = client.process_zip(
            args.zip_file,
            args.bucket,
            args.base_path,
            args.max_workers
        )
        
        if result:
            print("\n" + "="*60)
            print("Processing Complete!")
            print("="*60)
            print(json.dumps(result['summary'], indent=2))
            print("="*60)
            print(f"\nTotal images processed: {result['summary']['total_images']}")
            print(f"Successful: {result['summary']['processed_successfully']}")
            print(f"Errors: {result['summary']['errors']}")
            print(f"\nResults stored in: gs://{args.bucket}/{args.base_path}")
        
    elif args.action == 'download':
        if not args.bucket or not args.base_path:
            print("Error: --bucket and --base-path are required for download action")
            return
        
        embeddings = client.download_embeddings(
            args.bucket,
            args.base_path,
            args.output_dir
        )
        
        if embeddings:
            print(f"\nDownloaded {len(embeddings)} embedding files to {args.output_dir}")

if __name__ == '__main__':
    main()

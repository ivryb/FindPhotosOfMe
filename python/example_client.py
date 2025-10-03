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
    
    def compare_faces(self, reference_image_path, bucket_name, base_path, 
                      similarity_threshold=0.6, gender_match=True, return_top_n=None):
        """
        Compare a reference face with stored embeddings
        
        Args:
            reference_image_path: Path to reference image file
            bucket_name: GCS bucket name
            base_path: Base path containing embeddings
            similarity_threshold: Minimum similarity score (0.0 to 1.0)
            gender_match: Whether to require gender match
            return_top_n: Return only top N matches (optional)
            
        Returns:
            Response JSON or None if failed
        """
        ref_path = Path(reference_image_path)
        
        if not ref_path.exists():
            print(f"Error: Reference image not found: {reference_image_path}")
            return None
        
        print(f"Comparing faces with reference: {ref_path.name}")
        print(f"Similarity threshold: {similarity_threshold}")
        print(f"Gender matching: {'enabled' if gender_match else 'disabled'}")
        
        try:
            with open(ref_path, 'rb') as f:
                files = {'reference_image': (ref_path.name, f, 'image/jpeg')}
                data = {
                    'bucket_name': bucket_name,
                    'base_path': base_path,
                    'similarity_threshold': str(similarity_threshold),
                    'gender_match': 'true' if gender_match else 'false'
                }
                
                if return_top_n:
                    data['return_top_n'] = str(return_top_n)
                
                response = requests.post(
                    f"{self.service_url}/compare-faces",
                    files=files,
                    data=data,
                    timeout=600  # 10 minutes
                )
                
                response.raise_for_status()
                return response.json()
                
        except requests.exceptions.Timeout:
            print("Error: Request timed out")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            return None
    
    def compare_faces_from_gcs(self, reference_gcs_path, bucket_name, base_path,
                               similarity_threshold=0.6, gender_match=True, return_top_n=None):
        """
        Compare a reference face (from GCS) with stored embeddings
        
        Args:
            reference_gcs_path: GCS path to reference image (without gs:// prefix)
            bucket_name: GCS bucket name
            base_path: Base path containing embeddings
            similarity_threshold: Minimum similarity score (0.0 to 1.0)
            gender_match: Whether to require gender match
            return_top_n: Return only top N matches (optional)
            
        Returns:
            Response JSON or None if failed
        """
        print(f"Comparing faces with reference: {reference_gcs_path}")
        print(f"Similarity threshold: {similarity_threshold}")
        
        try:
            data = {
                'reference_image_gcs_path': reference_gcs_path,
                'bucket_name': bucket_name,
                'base_path': base_path,
                'similarity_threshold': similarity_threshold,
                'gender_match': gender_match
            }
            
            if return_top_n:
                data['return_top_n'] = return_top_n
            
            response = requests.post(
                f"{self.service_url}/compare-faces",
                json=data,
                timeout=600
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            return None
    
    def download_embeddings(self, bucket_name, base_path, output_file='embeddings.json'):
        """
        Download consolidated embeddings file from GCS
        
        Note: This requires google-cloud-storage to be installed and
        proper authentication to be set up locally
        
        Args:
            bucket_name: GCS bucket name
            base_path: Base path in bucket
            output_file: Local file path to save embeddings (default: embeddings.json)
        """
        try:
            from google.cloud import storage
            
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            # Ensure base_path doesn't end with /
            if base_path.endswith('/'):
                base_path = base_path.rstrip('/')
            
            # Download consolidated embeddings file
            embeddings_path = f"{base_path}/embeddings.json"
            blob = bucket.blob(embeddings_path)
            
            if not blob.exists():
                print(f"Error: Embeddings file not found at {embeddings_path}")
                return None
            
            # Download and parse
            content = blob.download_as_text()
            embeddings_data = json.loads(content)
            
            # Save locally
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w') as f:
                json.dump(embeddings_data, f, indent=2)
            
            print(f"Downloaded consolidated embeddings file: {output_file}")
            print(f"Total images with faces: {embeddings_data['metadata']['images_with_faces']}")
            print(f"Total faces: {embeddings_data['metadata']['total_faces']}")
            
            return embeddings_data
            
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
    parser.add_argument('--action', required=True, 
                       choices=['health', 'process', 'compare', 'download'],
                       help='Action to perform')
    parser.add_argument('--zip-file', help='Path to zip file (for process action)')
    parser.add_argument('--reference-image', help='Path to reference image (for compare action)')
    parser.add_argument('--bucket', help='GCS bucket name')
    parser.add_argument('--base-path', help='Base path in bucket')
    parser.add_argument('--max-workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--similarity-threshold', type=float, default=0.6, 
                       help='Similarity threshold (0.0-1.0, default: 0.6)')
    parser.add_argument('--no-gender-match', action='store_true', 
                       help='Disable gender matching requirement')
    parser.add_argument('--top-n', type=int, help='Return only top N matches')
    parser.add_argument('--output-file', default='embeddings.json', help='Output file for embeddings download')
    
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
    
    elif args.action == 'compare':
        if not args.reference_image or not args.bucket or not args.base_path:
            print("Error: --reference-image, --bucket, and --base-path are required for compare action")
            return
        
        result = client.compare_faces(
            args.reference_image,
            args.bucket,
            args.base_path,
            args.similarity_threshold,
            not args.no_gender_match,
            args.top_n
        )
        
        if result:
            print("\n" + "="*60)
            print("Face Comparison Complete!")
            print("="*60)
            print(f"Reference Gender: {result['reference_gender']}")
            print(f"Similarity Threshold: {result['similarity_threshold']}")
            print(f"Gender Match Required: {result['gender_match_required']}")
            print(f"Images Checked: {result['total_images_checked']}")
            print(f"Faces Checked: {result['total_faces_checked']}")
            print(f"Matches Found: {result['matches_found']}")
            print("="*60)
            
            if result['matches']:
                print("\nTop Matches:")
                for i, match in enumerate(result['matches'][:10], 1):
                    print(f"\n{i}. {match['image_name']}")
                    print(f"   Similarity: {match['similarity']:.4f}")
                    print(f"   Gender: {match['gender']}")
                    print(f"   Path: {match['image_path']}")
                
                if result['matches_found'] > 10:
                    print(f"\n... and {result['matches_found'] - 10} more matches")
            else:
                print("\nNo matches found.")
        
    elif args.action == 'download':
        if not args.bucket or not args.base_path:
            print("Error: --bucket and --base-path are required for download action")
            return
        
        embeddings = client.download_embeddings(
            args.bucket,
            args.base_path,
            args.output_file
        )
        
        if embeddings:
            print(f"\nConsolidated embeddings saved to: {args.output_file}")

if __name__ == '__main__':
    main()


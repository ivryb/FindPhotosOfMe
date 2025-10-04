import os
import shutil
from pathlib import Path
import numpy as np
from tqdm import tqdm
import insightface
from insightface.app import FaceAnalysis
import cv2
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
import warnings
import boto3
from botocore.exceptions import ClientError
import tempfile
from dotenv import load_dotenv
import io

# Load environment variables
load_dotenv()

# Suppress specific FutureWarning from numpy
warnings.filterwarnings("ignore", category=FutureWarning, module="numpy.linalg")

class R2StorageManager:
    """Manages interactions with Cloudflare R2 storage."""
    
    def __init__(self, account_id=None, access_key_id=None, secret_access_key=None, bucket_name=None):
        """Initialize R2 storage manager with credentials."""
        self.account_id = account_id or os.getenv('R2_ACCOUNT_ID')
        self.access_key_id = access_key_id or os.getenv('R2_ACCESS_KEY_ID')
        self.secret_access_key = secret_access_key or os.getenv('R2_SECRET_ACCESS_KEY')
        self.bucket_name = bucket_name or os.getenv('R2_BUCKET_NAME')
        
        if not all([self.account_id, self.access_key_id, self.secret_access_key, self.bucket_name]):
            raise ValueError("Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.")
        
        # Cloudflare R2 endpoint
        endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
        
        # Initialize S3-compatible client for R2
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name='auto'
        )
        
        print(f"[{self._get_time()}] R2 storage initialized for bucket: {self.bucket_name}")
    
    def _get_time(self):
        return datetime.now().strftime("%H:%M:%S")
    
    def list_objects(self, prefix=''):
        """List all objects in the bucket with the given prefix."""
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            
            objects = []
            for page in pages:
                if 'Contents' in page:
                    objects.extend(page['Contents'])
            
            return objects
        except ClientError as e:
            print(f"[{self._get_time()}] Error listing objects: {e}")
            return []
    
    def download_object(self, key, local_path):
        """Download an object from R2 to local path."""
        try:
            self.s3_client.download_file(self.bucket_name, key, str(local_path))
            return True
        except ClientError as e:
            print(f"[{self._get_time()}] Error downloading {key}: {e}")
            return False
    
    def download_object_to_memory(self, key):
        """Download an object from R2 to memory."""
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            return response['Body'].read()
        except ClientError as e:
            print(f"[{self._get_time()}] Error downloading {key} to memory: {e}")
            return None
    
    def upload_object(self, local_path, key):
        """Upload a local file to R2."""
        try:
            self.s3_client.upload_file(str(local_path), self.bucket_name, key)
            return True
        except ClientError as e:
            print(f"[{self._get_time()}] Error uploading {key}: {e}")
            return False
    
    def upload_from_memory(self, file_data, key, content_type='image/jpeg'):
        """Upload file data from memory to R2."""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_data,
                ContentType=content_type
            )
            return True
        except ClientError as e:
            print(f"[{self._get_time()}] Error uploading {key} from memory: {e}")
            return False

class PhotoFilter:
    def __init__(self):
        print(f"[{self._get_time()}] Initializing face recognition model...")
        self.app = FaceAnalysis(
            name='buffalo_l',
            root='.',
            providers=['CPUExecutionProvider']
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        print(f"[{self._get_time()}] Face recognition model loaded successfully")

    def _get_time(self):
        return datetime.now().strftime("%H:%M:%S")

    def get_face_features(self, image):
        faces = self.app.get(image)
        return [(face.embedding, face.gender) for face in faces]

    def are_faces_similar(self, embedding1, embedding2, threshold=0.6):
        if embedding1 is None or embedding2 is None:
            return False
        similarity = np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
        return similarity > threshold

    def process_photo(self, photo_path, ref_embedding, ref_gender, output_path):
        try:
            img = cv2.imread(str(photo_path))
            if img is None:
                return False

            face_features = self.get_face_features(img)
            if not face_features:
                return False

            for face_embedding, face_gender in face_features:
                similarity = np.dot(ref_embedding, face_embedding) / (np.linalg.norm(ref_embedding) * np.linalg.norm(face_embedding))
                
                if similarity > 0.6 and ref_gender == face_gender:
                    shutil.copy2(photo_path, output_path / photo_path.name)
                    return True

            return False

        except Exception as e:
            print(f"\n[{self._get_time()}] Error processing {photo_path.name}: {e}")
            return False
    
    def process_photo_from_memory(self, img_data, ref_embedding, ref_gender, photo_name):
        """Process a photo loaded from memory."""
        try:
            # Decode image from bytes
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return False, None

            face_features = self.get_face_features(img)
            if not face_features:
                return False, None

            for face_embedding, face_gender in face_features:
                similarity = np.dot(ref_embedding, face_embedding) / (np.linalg.norm(ref_embedding) * np.linalg.norm(face_embedding))
                
                if similarity > 0.6 and ref_gender == face_gender:
                    # Encode image back to bytes
                    _, buffer = cv2.imencode('.jpg', img)
                    return True, buffer.tobytes()

            return False, None

        except Exception as e:
            print(f"\n[{self._get_time()}] Error processing {photo_name}: {e}")
            return False, None

    def process_photos(self, input_folder, output_folder, reference_photo_path, batch_size=100):
        output_path = Path(output_folder)
        output_path.mkdir(parents=True, exist_ok=True)
        
        print(f"[{self._get_time()}] Loading reference photo: {reference_photo_path}")
        reference_img = cv2.imread(reference_photo_path)
        if reference_img is None:
            raise ValueError(f"Could not load reference photo: {reference_photo_path}")
        
        ref_features = self.get_face_features(reference_img)
        if not ref_features:
            raise ValueError("Could not detect face in reference photo")
        
        ref_embedding, ref_gender = ref_features[0]
        
        print(f"[{self._get_time()}] Reference photo analyzed successfully")
        print(f"[{self._get_time()}] Reference gender detected: {'male' if ref_gender == 1 else 'female'}")

        photo_files = list(Path(input_folder).glob("*.jpg")) + \
                     list(Path(input_folder).glob("*.jpeg")) + \
                     list(Path(input_folder).glob("*.png"))
        total_photos = len(photo_files)
        
        print(f"\n[{self._get_time()}] Starting processing of {total_photos} photos...")
        
        matches = 0
        
        with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
            futures = []
            for i in range(0, total_photos, batch_size):
                batch = photo_files[i:i+batch_size]
                futures.extend([executor.submit(self.process_photo, photo_path, ref_embedding, ref_gender, output_path) for photo_path in batch])
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="Processing photos"):
                if future.result():
                    matches += 1

        print(f"\n[{self._get_time()}] Processing completed!")
        print(f"[{self._get_time()}] Total photos processed: {total_photos}")
        print(f"[{self._get_time()}] Matches found: {matches}")
        print(f"[{self._get_time()}] Match rate: {(matches / total_photos) * 100:.1f}%")
    
    def process_photos_from_r2(self, storage_manager, input_prefix, output_prefix, reference_photo_key, batch_size=100):
        """Process photos stored in Cloudflare R2."""
        
        print(f"[{self._get_time()}] Loading reference photo from R2: {reference_photo_key}")
        ref_img_data = storage_manager.download_object_to_memory(reference_photo_key)
        if ref_img_data is None:
            raise ValueError(f"Could not load reference photo from R2: {reference_photo_key}")
        
        # Decode reference image
        nparr = np.frombuffer(ref_img_data, np.uint8)
        reference_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if reference_img is None:
            raise ValueError(f"Could not decode reference photo: {reference_photo_key}")
        
        ref_features = self.get_face_features(reference_img)
        if not ref_features:
            raise ValueError("Could not detect face in reference photo")
        
        ref_embedding, ref_gender = ref_features[0]
        
        print(f"[{self._get_time()}] Reference photo analyzed successfully")
        print(f"[{self._get_time()}] Reference gender detected: {'male' if ref_gender == 1 else 'female'}")
        
        # List all photos from R2
        print(f"[{self._get_time()}] Listing photos from R2 with prefix: {input_prefix}")
        objects = storage_manager.list_objects(prefix=input_prefix)
        
        # Filter for image files
        photo_keys = [
            obj['Key'] for obj in objects
            if obj['Key'].lower().endswith(('.jpg', '.jpeg', '.png'))
        ]
        total_photos = len(photo_keys)
        
        print(f"[{self._get_time()}] Found {total_photos} photos in R2")
        print(f"\n[{self._get_time()}] Starting processing of {total_photos} photos...")
        
        matches = 0
        matched_photos = []
        
        # Process photos one by one (can be optimized with multiprocessing if needed)
        for photo_key in tqdm(photo_keys, desc="Processing photos"):
            try:
                # Download photo from R2
                img_data = storage_manager.download_object_to_memory(photo_key)
                if img_data is None:
                    continue
                
                # Process photo
                is_match, processed_img_data = self.process_photo_from_memory(
                    img_data, ref_embedding, ref_gender, photo_key
                )
                
                if is_match and processed_img_data:
                    # Upload matched photo to output prefix
                    photo_name = photo_key.split('/')[-1]
                    output_key = f"{output_prefix}/{photo_name}"
                    
                    if storage_manager.upload_from_memory(processed_img_data, output_key):
                        matches += 1
                        matched_photos.append(output_key)
                
            except Exception as e:
                print(f"\n[{self._get_time()}] Error processing {photo_key}: {e}")
                continue
        
        print(f"\n[{self._get_time()}] Processing completed!")
        print(f"[{self._get_time()}] Total photos processed: {total_photos}")
        print(f"[{self._get_time()}] Matches found: {matches}")
        print(f"[{self._get_time()}] Match rate: {(matches / total_photos) * 100:.1f}%")
        print(f"[{self._get_time()}] Matched photos uploaded to: {output_prefix}/")
        
        return matched_photos

def main():
    # Check if we should use R2 or local processing
    use_r2 = os.getenv('USE_R2', 'false').lower() == 'true'
    
    if use_r2:
        print("Using Cloudflare R2 for storage")
        
        # Initialize R2 storage manager
        storage_manager = R2StorageManager()
        
        # R2 configuration
        INPUT_PREFIX = os.getenv('R2_INPUT_PREFIX', 'input')
        OUTPUT_PREFIX = os.getenv('R2_OUTPUT_PREFIX', 'output')
        REFERENCE_PHOTO_KEY = os.getenv('R2_REFERENCE_PHOTO', 'ref.jpg')
        
        # Initialize and run photo filter with R2
        photo_filter = PhotoFilter()
        photo_filter.process_photos_from_r2(
            storage_manager,
            INPUT_PREFIX,
            OUTPUT_PREFIX,
            REFERENCE_PHOTO_KEY,
            batch_size=100
        )
    else:
        print("Using local filesystem for storage")
        
        # Local configuration
        INPUT_FOLDER = "all"
        OUTPUT_FOLDER = "filtered"
        REFERENCE_PHOTO = "ref.jpg"
        
        # Initialize and run photo filter locally
        photo_filter = PhotoFilter()
        photo_filter.process_photos(INPUT_FOLDER, OUTPUT_FOLDER, REFERENCE_PHOTO, batch_size=100)

if __name__ == "__main__":
    main()

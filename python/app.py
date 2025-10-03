import os
import io
import json
import zipfile
import tempfile
from pathlib import Path
import numpy as np
from flask import Flask, request, jsonify
from google.cloud import storage
import insightface
from insightface.app import FaceAnalysis
import cv2
from datetime import datetime
import logging
from concurrent.futures import ThreadPoolExecutor
import warnings

# Suppress specific FutureWarning from numpy
warnings.filterwarnings("ignore", category=FutureWarning, module="numpy.linalg")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global face analysis model (initialized once)
face_app = None

def get_time():
    """Get current time as formatted string"""
    return datetime.now().strftime("%H:%M:%S")

def initialize_face_model():
    """Initialize the face recognition model once at startup"""
    global face_app
    if face_app is None:
        logger.info(f"[{get_time()}] Initializing face recognition model...")
        face_app = FaceAnalysis(
            name='buffalo_l',
            root='.',
            providers=['CPUExecutionProvider']
        )
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info(f"[{get_time()}] Face recognition model loaded successfully")
    return face_app

def get_face_embeddings(image):
    """Extract face embeddings from an image"""
    app = initialize_face_model()
    faces = app.get(image)
    return [(face.embedding, face.gender, face.bbox) for face in faces]

def upload_to_gcs(bucket_name, blob_path, data):
    """Upload data to Google Cloud Storage"""
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        if isinstance(data, bytes):
            blob.upload_from_string(data)
        else:
            blob.upload_from_filename(data)
        
        return f"gs://{bucket_name}/{blob_path}"
    except Exception as e:
        logger.error(f"Error uploading to GCS: {e}")
        raise

def process_image_from_zip(image_data, image_name, bucket_name, base_path):
    """
    Process a single image: detect faces, extract embeddings, and upload to GCS
    Returns metadata about the processed image
    """
    try:
        # Decode image from bytes
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.warning(f"Could not decode image: {image_name}")
            return None
        
        # Get face embeddings
        face_features = get_face_embeddings(img)
        
        if not face_features:
            logger.info(f"No faces detected in: {image_name}")
            # Still upload the image even if no faces detected
            image_path = f"{base_path}/images/{image_name}"
            upload_to_gcs(bucket_name, image_path, image_data)
            return {
                "image_name": image_name,
                "image_path": image_path,
                "faces_count": 0,
                "faces": []
            }
        
        # Upload the image to GCS
        image_path = f"{base_path}/images/{image_name}"
        upload_to_gcs(bucket_name, image_path, image_data)
        
        # Prepare face embeddings data
        faces_data = []
        for idx, (embedding, gender, bbox) in enumerate(face_features):
            face_info = {
                "face_index": idx,
                "embedding": embedding.tolist(),
                "gender": "male" if gender == 1 else "female",
                "bbox": bbox.tolist() if bbox is not None else None
            }
            faces_data.append(face_info)
        
        # Upload embeddings as JSON file
        embeddings_path = f"{base_path}/embeddings/{Path(image_name).stem}.json"
        embeddings_json = json.dumps({
            "image_name": image_name,
            "image_path": image_path,
            "faces_count": len(face_features),
            "faces": faces_data,
            "processed_at": datetime.utcnow().isoformat()
        }, indent=2)
        
        upload_to_gcs(bucket_name, embeddings_path, embeddings_json.encode('utf-8'))
        
        logger.info(f"Processed {image_name}: {len(face_features)} face(s) detected")
        
        return {
            "image_name": image_name,
            "image_path": image_path,
            "embeddings_path": embeddings_path,
            "faces_count": len(face_features),
            "faces": faces_data
        }
        
    except Exception as e:
        logger.error(f"Error processing image {image_name}: {e}")
        return {
            "image_name": image_name,
            "error": str(e),
            "faces_count": 0
        }

def stream_process_zip(zip_file_data, bucket_name, base_path, max_workers=4):
    """
    Stream process images from a zip file
    Processes images as they are extracted without storing all in memory
    """
    results = []
    processed_count = 0
    error_count = 0
    
    try:
        # Open zip file from memory
        with zipfile.ZipFile(io.BytesIO(zip_file_data)) as zf:
            # Get list of image files
            image_files = [f for f in zf.namelist() 
                          if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))
                          and not f.startswith('__MACOSX')
                          and not f.startswith('.')]
            
            total_images = len(image_files)
            logger.info(f"Found {total_images} images in zip file")
            
            # Process images with thread pool for parallel processing
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = []
                
                for image_file in image_files:
                    # Extract image data
                    image_data = zf.read(image_file)
                    image_name = Path(image_file).name
                    
                    # Submit processing task
                    future = executor.submit(
                        process_image_from_zip,
                        image_data,
                        image_name,
                        bucket_name,
                        base_path
                    )
                    futures.append(future)
                
                # Collect results as they complete
                for future in futures:
                    result = future.result()
                    if result:
                        results.append(result)
                        if "error" not in result:
                            processed_count += 1
                        else:
                            error_count += 1
            
            logger.info(f"Processing completed: {processed_count} successful, {error_count} errors")
            
    except Exception as e:
        logger.error(f"Error processing zip file: {e}")
        raise
    
    return {
        "total_images": len(results),
        "processed_successfully": processed_count,
        "errors": error_count,
        "results": results
    }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})

@app.route('/process-zip', methods=['POST'])
def process_zip_endpoint():
    """
    Main endpoint to process uploaded zip file
    
    Expected:
    - File upload with key 'zip_file'
    - Form data: bucket_name, base_path (optional)
    
    Returns:
    - JSON with processing results
    """
    try:
        # Check if file is present
        if 'zip_file' not in request.files:
            return jsonify({"error": "No zip file provided"}), 400
        
        zip_file = request.files['zip_file']
        
        if zip_file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        # Get bucket name and base path from form data
        bucket_name = request.form.get('bucket_name')
        if not bucket_name:
            return jsonify({"error": "bucket_name is required"}), 400
        
        base_path = request.form.get('base_path', f'face-processing/{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}')
        max_workers = int(request.form.get('max_workers', 4))
        
        logger.info(f"Starting zip processing: bucket={bucket_name}, base_path={base_path}")
        
        # Read zip file data
        zip_data = zip_file.read()
        
        # Initialize face model before processing
        initialize_face_model()
        
        # Process the zip file with streaming
        results = stream_process_zip(zip_data, bucket_name, base_path, max_workers)
        
        # Upload summary
        summary = {
            "bucket_name": bucket_name,
            "base_path": base_path,
            "total_images": results["total_images"],
            "processed_successfully": results["processed_successfully"],
            "errors": results["errors"],
            "completed_at": datetime.utcnow().isoformat()
        }
        
        summary_path = f"{base_path}/summary.json"
        upload_to_gcs(bucket_name, summary_path, json.dumps(summary, indent=2).encode('utf-8'))
        
        response = {
            "success": True,
            "summary": summary,
            "summary_path": summary_path,
            "results": results["results"]
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error in process_zip_endpoint: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/compare-faces', methods=['POST'])
def compare_faces_endpoint():
    """
    Endpoint to compare a reference face with stored embeddings
    
    Expected JSON:
    {
        "reference_image_path": "gs://bucket/path/to/reference.jpg",
        "embeddings_base_path": "gs://bucket/path/to/embeddings/",
        "similarity_threshold": 0.6,
        "gender_match": true
    }
    
    Returns:
    - JSON with matching images
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        # This is a placeholder for face comparison logic
        # You would implement the actual comparison logic here
        # reading embeddings from GCS and comparing with reference
        
        return jsonify({
            "success": True,
            "message": "Face comparison endpoint - to be implemented"
        }), 200
        
    except Exception as e:
        logger.error(f"Error in compare_faces_endpoint: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Initialize model at startup
    initialize_face_model()
    
    # Run the app
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

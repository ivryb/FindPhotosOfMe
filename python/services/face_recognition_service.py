"""Face recognition service for analyzing photos and extracting embeddings."""

import os
from functools import lru_cache

import numpy as np
import cv2
from insightface.app import FaceAnalysis
from datetime import datetime
from typing import List
import warnings

# Suppress numpy warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="numpy.linalg")


class FaceRecognitionService:
    """Handles face detection and embedding extraction."""
    
    def __init__(self):
        """Initialize face recognition model."""
        print(f"[{self._get_time()}] Initializing face recognition model...")
        self.app = FaceAnalysis(
            name='buffalo_l',
            root=os.getenv('INSIGHTFACE_ROOT', '.'),
            providers=['CPUExecutionProvider']
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        print(f"[{self._get_time()}] Face recognition model loaded successfully")
    
    def _get_time(self) -> str:
        """Get current time as formatted string."""
        return datetime.now().strftime("%H:%M:%S")
    
    def extract_embeddings(self, image_data: bytes) -> List[dict]:
        """Extract face embeddings from image data.
        
        Args:
            image_data: Image data as bytes
            
        Returns:
            List of dictionaries containing embedding and gender for each face
        """
        try:
            # Decode image from bytes
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                print(f"[{self._get_time()}] Failed to decode image")
                return []
            
            # Get faces
            faces = self.app.get(img)
            
            # Extract embeddings and metadata
            results = []
            for face in faces:
                results.append({
                    'embedding': face.embedding.tolist(),  # Convert numpy array to list
                    'gender': int(face.gender),  # 0 = female, 1 = male
                    'age': int(face.age) if hasattr(face, 'age') else None,
                    'bbox': face.bbox.tolist() if hasattr(face, 'bbox') else None
                })
            
            return results
            
        except Exception as e:
            print(f"[{self._get_time()}] Error extracting embeddings: {e}")
            return []


@lru_cache(maxsize=1)
def get_face_service() -> FaceRecognitionService:
    """Modal workers accept one input at a time and reuse the loaded model."""
    return FaceRecognitionService()

"""Face recognition service for analyzing photos and extracting embeddings."""

import numpy as np
import cv2
from insightface.app import FaceAnalysis
from datetime import datetime
from typing import List, Tuple, Optional
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
            root='.',
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
    
    def compare_embeddings(
        self, 
        ref_embedding: List[float], 
        target_embedding: List[float], 
        threshold: float = 0.6
    ) -> Tuple[bool, float]:
        """Compare two face embeddings.
        
        Args:
            ref_embedding: Reference face embedding
            target_embedding: Target face embedding to compare
            threshold: Similarity threshold (0-1)
            
        Returns:
            Tuple of (is_match, similarity_score)
        """
        try:
            # Convert lists back to numpy arrays
            ref_arr = np.array(ref_embedding)
            target_arr = np.array(target_embedding)
            
            # Calculate cosine similarity
            similarity = np.dot(ref_arr, target_arr) / (
                np.linalg.norm(ref_arr) * np.linalg.norm(target_arr)
            )
            
            is_match = similarity > threshold
            return is_match, float(similarity)
            
        except Exception as e:
            print(f"[{self._get_time()}] Error comparing embeddings: {e}")
            return False, 0.0
    
    def find_matching_faces(
        self,
        ref_embedding: List[float],
        ref_gender: int,
        embeddings_data: dict,
        threshold: float = 0.6
    ) -> List[Tuple[str, float]]:
        """Find matching faces in embeddings data.
        
        Args:
            ref_embedding: Reference face embedding
            ref_gender: Reference face gender (0=female, 1=male)
            embeddings_data: Dictionary mapping filenames to their embeddings
            threshold: Similarity threshold
            
        Returns:
            List of tuples (filename, similarity_score) for matches
        """
        matches = []
        
        for filename, faces in embeddings_data.items():
            for face in faces:
                # Check gender match
                if face.get('gender') != ref_gender:
                    continue
                
                # Compare embeddings
                is_match, similarity = self.compare_embeddings(
                    ref_embedding,
                    face['embedding'],
                    threshold
                )
                
                if is_match:
                    matches.append((filename, similarity))
                    break  # Only need one match per photo
        
        # Sort by similarity score (highest first)
        matches.sort(key=lambda x: x[1], reverse=True)
        
        return matches

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

# Suppress specific FutureWarning from numpy
warnings.filterwarnings("ignore", category=FutureWarning, module="numpy.linalg")

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

def main():
    INPUT_FOLDER = "all"
    OUTPUT_FOLDER = "filtered"
    REFERENCE_PHOTO = "ref.jpg"
    
    photo_filter = PhotoFilter()
    photo_filter.process_photos(INPUT_FOLDER, OUTPUT_FOLDER, REFERENCE_PHOTO, batch_size=100)

if __name__ == "__main__":
    main()

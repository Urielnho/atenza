"""Local identity comparison. This is not Pixel Face Unlock or liveness detection."""
import base64
import os
from pathlib import Path
from threading import Lock
# Bound decoded dimensions as well as uploaded bytes before OpenCV allocates pixels.
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(24_000_000))
import cv2
import numpy as np


class FaceEngine:
    def __init__(self, models: Path):
        self.lock = Lock()
        self.detector = cv2.FaceDetectorYN.create(str(models / "yunet.onnx"), "", (320, 320), 0.9)
        self.recognizer = cv2.FaceRecognizerSF.create(str(models / "sface.onnx"), "")

    def embedding(self, encoded: str) -> list[float]:
        try:
            raw = base64.b64decode(encoded, validate=True)
            if len(raw) > 4_000_000:
                raise ValueError("La imagen es demasiado grande.")
            image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("No se pudo leer la imagen.")
            height, width = image.shape[:2]
            if max(height, width) > 1600:
                image = cv2.resize(image, (int(width * 1600 / max(height, width)), int(height * 1600 / max(height, width))))
            with self.lock:
                self.detector.setInputSize((image.shape[1], image.shape[0]))
                _, faces = self.detector.detect(image)
                if faces is None or len(faces) != 1:
                    raise ValueError("Debe verse exactamente un rostro, de frente y con buena luz.")
                if min(faces[0][2:4]) < 90:
                    raise ValueError("Acerca tu rostro a la cámara.")
                aligned = self.recognizer.alignCrop(image, faces[0])
                vector = self.recognizer.feature(aligned).reshape(-1)
                norm = np.linalg.norm(vector)
                if not np.isfinite(norm) or norm == 0:
                    raise ValueError("No se pudo analizar el rostro.")
                return (vector / norm).tolist()
        except (cv2.error, base64.binascii.Error) as error:
            raise ValueError("No se pudo analizar la imagen. Intenta otra vez.") from error

    @staticmethod
    def matches(reference: list[float], candidate: list[float]) -> bool:
        # More conservative than the OpenCV tutorial's LFW cosine threshold 0.363.
        # Requires validation on the actual classroom camera; not a security certification.
        return len(reference) == len(candidate) == 128 and float(np.dot(reference, candidate)) >= 0.50

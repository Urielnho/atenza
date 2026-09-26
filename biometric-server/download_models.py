"""Download official OpenCV Zoo models; verify Git LFS SHA-256 before use."""
import hashlib
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parent / "models"
root.mkdir(exist_ok=True)
models = {
    "yunet": "face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "sface": "face_recognition_sface/face_recognition_sface_2021dec.onnx",
}
for name, path in models.items():
    pointer = urllib.request.urlopen("https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/" + path).read().decode()
    digest = next(line.split("sha256:")[1] for line in pointer.splitlines() if line.startswith("oid sha256:"))
    destination = root / (name + ".onnx")
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == digest:
        print(name + ": verified")
        continue
    contents = urllib.request.urlopen("https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/" + path).read()
    if hashlib.sha256(contents).hexdigest() != digest:
        raise RuntimeError("Model checksum mismatch: " + name)
    destination.write_bytes(contents)
    license_path = path.split("/")[0] + "/LICENSE"
    (root / (name + "-LICENSE")).write_bytes(urllib.request.urlopen("https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/" + license_path).read())
    print(name + ": downloaded and verified")

# service.py — Stage 1 OCR Microservice
# Denoising CNN → TrOCR → Text

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image
import io
import time
import base64
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import torchvision.transforms as transforms

# ─── App Setup ───────────────────────────────────────────────
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Running on: {device}")

# ─── Denoising CNN Architecture ──────────────────────────────
# Must match exactly what you trained in Colab
class DenoisingCNN(nn.Module):
    def __init__(self):
        super(DenoisingCNN, self).__init__()

        self.enc1 = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
        )
        self.pool1 = nn.MaxPool2d(2, 2)

        self.enc2 = nn.Sequential(
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
        )
        self.pool2 = nn.MaxPool2d(2, 2)

        self.enc3 = nn.Sequential(
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(),
            nn.Conv2d(128, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(),
        )

        self.up2   = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec2  = nn.Sequential(
            nn.Conv2d(128, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
        )

        self.up1   = nn.ConvTranspose2d(64, 32, 2, stride=2)
        self.dec1  = nn.Sequential(
            nn.Conv2d(64, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
        )

        self.output  = nn.Conv2d(32, 1, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool1(e1))
        e3 = self.enc3(self.pool2(e2))
        d2 = self.dec2(torch.cat([self.up2(e3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.sigmoid(self.output(d1))

# ─── Load Models at Startup ──────────────────────────────────
print("Loading denoising CNN...")
denoise_model = DenoisingCNN().to(device)
denoise_model.load_state_dict(
    torch.load("denoising_weights.pth", map_location=device)
)
denoise_model.eval()
print("Denoising CNN loaded ✓")

print("Loading TrOCR...")
processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-printed')
trocr     = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-printed')
trocr     = trocr.to(device)
trocr.eval()
print("TrOCR loaded ✓")

# ─── Helper: Denoise image with your CNN ─────────────────────
def denoise_image(img_gray: np.ndarray) -> np.ndarray:
    """
    Takes a grayscale numpy image (H x W),
    runs it through the denoising CNN,
    returns a clean grayscale numpy image (H x W)
    """
    transform = transforms.ToTensor()
    tensor = transform(img_gray).unsqueeze(0).to(device)  # 1x1xHxW

    with torch.no_grad():
        output = denoise_model(tensor)

    clean = (output.squeeze().cpu().numpy() * 255).astype(np.uint8)
    return clean

# ─── Helper: Split image into text lines ─────────────────────
def extract_lines(img_gray: np.ndarray):
    """
    Uses horizontal projection to find individual text lines.
    Returns list of (y1, y2) tuples for each line.
    """
    _, binary   = cv2.threshold(img_gray, 0, 255,
                                cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inverted    = cv2.bitwise_not(binary)
    h_proj      = np.sum(inverted, axis=1)

    threshold   = img_gray.shape[1] * 4
    in_line     = False
    line_start  = 0
    line_regions = []

    for y, val in enumerate(h_proj):
        if not in_line and val > threshold:
            in_line    = True
            line_start = y
        elif in_line and val <= threshold:
            in_line = False
            if y - line_start > 8:
                padding = 3
                y1 = max(0, line_start - padding)
                y2 = min(img_gray.shape[0], y + padding)
                line_regions.append((y1, y2))

    return line_regions

# ─── Helper: Run TrOCR on a single line ──────────────────────
def read_line(img_gray: np.ndarray, y1: int, y2: int):
    """
    Crops a line from the image and runs TrOCR on it.
    Returns (text, confidence)
    """
    line_crop = img_gray[y1:y2, :]

    # TrOCR needs RGB PIL image
    line_rgb  = cv2.cvtColor(line_crop, cv2.COLOR_GRAY2RGB)
    line_pil  = Image.fromarray(line_rgb)

    pixel_values = processor(
        line_pil, return_tensors="pt"
    ).pixel_values.to(device)

    with torch.no_grad():
        generated_ids = trocr.generate(
            pixel_values,
            max_new_tokens=128
        )

    text = processor.batch_decode(
        generated_ids,
        skip_special_tokens=True
    )[0].strip()

    return text

# ─── Helper: Apply noise-specific preprocessing ──────────────
def preprocess_for_noise(img_gray: np.ndarray, noise_profile: str) -> np.ndarray:
    """
    Apply the right filter BEFORE denoising CNN based on declared noise type.
    This gives the CNN a head start.
    """
    if noise_profile == "gaussian":
        return cv2.GaussianBlur(img_gray, (3, 3), 0)

    elif noise_profile == "salt_and_pepper":
        return cv2.medianBlur(img_gray, 3)

    elif noise_profile == "combined":
        step1 = cv2.medianBlur(img_gray, 3)
        step2 = cv2.GaussianBlur(step1, (3, 3), 0)
        return cv2.bilateralFilter(step2, 9, 75, 75)

    elif noise_profile == "crumpled":
        # CLAHE normalises uneven illumination from fold shadows
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        equalized = clahe.apply(img_gray)
        # Light sharpen to recover edge definition lost in creases
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        return cv2.filter2D(equalized, -1, kernel)

    elif noise_profile == "stained":
        # Aggressive CLAHE to cut through discoloration blotches
        clahe = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
        equalized = clahe.apply(img_gray)
        # Stretch contrast to push stain regions toward background
        return cv2.normalize(equalized, None, 0, 255, cv2.NORM_MINMAX)

    else:  # none
        return img_gray

# ─── Main Endpoint ────────────────────────────────────────────
@app.post("/ocr")
async def ocr(
    image: UploadFile = File(...),
    noise_profile: str = Form(default="gaussian")
):
    start_time = time.time()

    # 1. Read uploaded image
    img_bytes = await image.read()
    nparr     = np.frombuffer(img_bytes, np.uint8)
    img_color = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_color is None:
        return {"error": "Could not decode image", "text": "",
                "confidence": 0.0, "noise_profile_detected": noise_profile}

    img_gray = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)

    # 2. Classical preprocessing based on noise profile
    preprocessed = preprocess_for_noise(img_gray, noise_profile)

    # 3. YOUR CNN denoises the image
    denoised = denoise_image(preprocessed)

    # 4. Find text lines
    line_regions = extract_lines(denoised)

    if not line_regions:
        _, buf = cv2.imencode(".png", denoised)
        return {
            "text": "",
            "confidence": 0.0,
            "noise_profile_detected": noise_profile,
            "lines_found": 0,
            "denoised_image": base64.b64encode(buf.tobytes()).decode("ascii"),
            "latency_ms": round((time.time() - start_time) * 1000, 2)
        }

    # 5. TrOCR reads each line
    lines_text   = []
    for (y1, y2) in line_regions:
        line_text = read_line(denoised, y1, y2)
        if line_text:
            lines_text.append(line_text)

    full_text = "\n".join(lines_text)

    # 6. Estimate confidence based on output quality
    # TrOCR doesn't return confidence natively so we
    # use alphanumeric density as a proxy
    char_count  = sum(c.isalnum() for c in full_text)
    total_chars = max(len(full_text), 1)
    confidence  = round(min(char_count / total_chars, 1.0), 4)

    # 7. Encode denoised image as base64 PNG for frontend display
    _, buf = cv2.imencode(".png", denoised)
    denoised_b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    latency = round((time.time() - start_time) * 1000, 2)

    return {
        "text":                   full_text,
        "confidence":             confidence,
        "noise_profile_detected": noise_profile,
        "lines_found":            len(line_regions),
        "denoised_image":         denoised_b64,
        "latency_ms":             latency
    }

# ─── Health Check ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":            "ok",
        "denoising_cnn":     "loaded",
        "trocr":             "loaded",
        "device":            str(device)
    }

# ─── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
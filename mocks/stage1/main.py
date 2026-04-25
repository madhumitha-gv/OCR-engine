"""
Mock Stage 1 — OCR Microservice (port 8001)

Reads the actual uploaded image, derives a plausible digit string from it,
and returns realistic confidence + noise detection fields.
Replace this entirely with the real CNN when ready.
"""

import io, random, hashlib
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mock OCR Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Helpers ───────────────────────────────────────────────────────────────────

def _image_to_text(image_bytes: bytes) -> str:
    """
    Deterministic mock: hash the image bytes → pick 4-6 digits.
    Same image always returns same text (good for testing decompression verify).
    """
    digest = hashlib.md5(image_bytes).hexdigest()
    # Turn first 6 hex chars into digits 0-9
    digits = [str(int(c, 16) % 10) for c in digest[:6]]
    # Length varies 4–6 based on image size
    length = 4 + (len(image_bytes) % 3)
    return "".join(digits[:length])

def _detect_noise(noise_profile: str, image_bytes: bytes) -> str:
    """Return detected noise — mirrors what was requested, with occasional variance."""
    if noise_profile != "none":
        return noise_profile
    # For 'none', mock detector occasionally finds residual noise
    if len(image_bytes) % 7 == 0:
        return random.choice(["gaussian", "none"])
    return "none"

def _confidence(noise_profile: str, image_bytes: bytes) -> float:
    """Higher confidence on clean images, lower on noisy ones."""
    base = {
        "none":            0.97,
        "gaussian":        0.91,
        "salt_and_pepper": 0.88,
        "both":            0.84,
    }.get(noise_profile, 0.90)
    # small deterministic jitter based on image content
    jitter = (len(image_bytes) % 100) / 1000.0
    return round(min(0.99, base + jitter - 0.05), 3)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "mock-ocr"}

@app.post("/ocr")
async def ocr(
    image: UploadFile = File(...),
    noise_profile: str = Form("none"),
    run_id: str = Form(""),        # forwarded by orchestrator, ignored here
):
    image_bytes = await image.read()

    text       = _image_to_text(image_bytes)
    confidence = _confidence(noise_profile, image_bytes)
    detected   = _detect_noise(noise_profile, image_bytes)

    return {
        "text":                   text,
        "confidence":             confidence,
        "noise_profile_detected": detected,
    }

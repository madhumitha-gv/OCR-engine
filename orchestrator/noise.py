"""
Noise augmentation utilities.
Applies Gaussian and/or Salt-and-Pepper noise to image bytes.
Called by the orchestrator before forwarding to Stage 1.
"""

import io
import numpy as np
from PIL import Image


def _to_array(image_bytes: bytes) -> tuple[np.ndarray, str]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(img, dtype=np.float32), img.format or "PNG"


def _to_bytes(arr: np.ndarray, fmt: str) -> bytes:
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format=fmt if fmt in ("PNG", "JPEG", "BMP") else "PNG")
    return buf.getvalue()


def apply_gaussian(image_bytes: bytes, std: float = 25.0) -> bytes:
    """Add Gaussian noise with given standard deviation (default σ=25)."""
    arr, fmt = _to_array(image_bytes)
    noise = np.random.normal(0, std, arr.shape).astype(np.float32)
    return _to_bytes(arr + noise, fmt)


def apply_salt_and_pepper(image_bytes: bytes, amount: float = 0.05) -> bytes:
    """
    Randomly set `amount` fraction of pixels to pure white or pure black.
    Default: 5% of pixels affected.
    """
    arr, fmt = _to_array(image_bytes)
    out = arr.copy()
    n_pixels = arr.shape[0] * arr.shape[1]
    n_salt   = int(n_pixels * amount / 2)
    n_pepper = int(n_pixels * amount / 2)

    # Salt (white)
    coords = [np.random.randint(0, d, n_salt) for d in arr.shape[:2]]
    out[coords[0], coords[1]] = 255

    # Pepper (black)
    coords = [np.random.randint(0, d, n_pepper) for d in arr.shape[:2]]
    out[coords[0], coords[1]] = 0

    return _to_bytes(out, fmt)


def apply_noise(image_bytes: bytes, profile: str) -> bytes:
    """
    Apply noise based on profile string.
    profile: 'none' | 'gaussian' | 'salt_and_pepper' | 'both'
    Returns the (possibly modified) image bytes.
    """
    if profile == "gaussian":
        return apply_gaussian(image_bytes)
    if profile == "salt_and_pepper":
        return apply_salt_and_pepper(image_bytes)
    if profile == "both":
        noisy = apply_gaussian(image_bytes)
        return apply_salt_and_pepper(noisy)
    return image_bytes   # 'none' — pass through unchanged

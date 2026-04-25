"""
Mock Stage 2 — Huffman Compression Microservice (port 8002)

Computes REAL entropy, real original_size_bits, and a realistic
compression_ratio / encoding_efficiency derived from actual character
frequencies — so all the UI metrics are mathematically valid.

The actual compression is a placeholder (base64 of reversed text).
Replace _compress() and _decompress() with the real Huffman implementation.
"""

import math, base64
from collections import Counter
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Mock Huffman Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class CompressRequest(BaseModel):
    text: str

class DecompressRequest(BaseModel):
    compressed: str

# ── Real metric computation ───────────────────────────────────────────────────

def _entropy(text: str) -> float:
    """Shannon entropy in bits per character."""
    if not text:
        return 0.0
    counts = Counter(text)
    n = len(text)
    return round(-sum((c / n) * math.log2(c / n) for c in counts.values()), 4)

def _huffman_avg_code_length(text: str) -> float:
    """
    Approximate average Huffman code length using the greedy lower bound:
    ceil(log2(1/p_i)) per symbol. Good enough for efficiency metric.
    """
    if not text:
        return 0.0
    counts = Counter(text)
    n = len(text)
    total_bits = sum(math.ceil(math.log2(n / c + 1)) * c for c in counts.values())
    return total_bits / n

def _metrics(text: str) -> dict:
    original_size_bits  = len(text) * 8          # 8 bits per ASCII char
    entropy             = _entropy(text)
    avg_len             = _huffman_avg_code_length(text)
    compressed_size_bits = max(1, round(avg_len * len(text)))
    compression_ratio   = round(original_size_bits / compressed_size_bits, 4)
    # encoding efficiency = entropy / avg_code_length  (1.0 = perfect)
    encoding_efficiency = round(entropy / avg_len, 4) if avg_len > 0 else 1.0

    return {
        "original_size_bits":   original_size_bits,
        "compressed_size_bits": compressed_size_bits,
        "compression_ratio":    compression_ratio,
        "entropy":              entropy,
        "encoding_efficiency":  min(1.0, encoding_efficiency),
    }

# ── Placeholder compress / decompress ────────────────────────────────────────
# TEAMMATES: replace these two functions with real Adaptive Huffman logic.

def _compress(text: str) -> str:
    """Placeholder: base64(reversed text). Swap with real Huffman bitstream."""
    payload = text[::-1].encode()          # reverse so decompression is testable
    return base64.b64encode(payload).decode()

def _decompress(compressed: str) -> str:
    """Placeholder: undo the fake compression above."""
    try:
        payload = base64.b64decode(compressed).decode()
        return payload[::-1]               # un-reverse
    except Exception as exc:
        raise HTTPException(400, f"Decompression failed: {exc}") from exc

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "mock-huffman"}

@app.post("/compress")
def compress(body: CompressRequest):
    if not body.text:
        raise HTTPException(400, "text must not be empty")

    m = _metrics(body.text)
    return {
        "compressed":           _compress(body.text),
        "original_size_bits":   m["original_size_bits"],
        "compressed_size_bits": m["compressed_size_bits"],
        "compression_ratio":    m["compression_ratio"],
        "entropy":              m["entropy"],
        "encoding_efficiency":  m["encoding_efficiency"],
    }

@app.post("/decompress")
def decompress(body: DecompressRequest):
    return {"text": _decompress(body.compressed)}

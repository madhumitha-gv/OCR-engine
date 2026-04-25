"""
Pipeline routes:
  POST /pipeline/run          — authenticated end-to-end run (saves image + result)
  POST /pipeline/relay/ocr    — Stage 1 calls this to hand off text to Stage 2
  POST /pipeline/decompress   — decompress stored run output
  GET  /health                — service health check
"""

import os
import time
import base64
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, PipelineRun
from auth import get_current_user

router = APIRouter(tags=["pipeline"])

OCR_URL     = os.getenv("OCR_URL",     "http://localhost:8001")
HUFFMAN_URL = os.getenv("HUFFMAN_URL", "http://localhost:8002")
MOCK_STAGES = os.getenv("MOCK_STAGES", "false").lower() == "true"
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "./uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# ── Schemas ───────────────────────────────────────────────────────────────────

class RelayRequest(BaseModel):
    run_id:                 int
    text:                   str
    confidence:             float
    noise_profile_detected: str

class RelayResponse(BaseModel):
    compressed_bytes:     str
    original_size_bits:   int
    compressed_size_bits: int
    compression_ratio:    float
    entropy:              float
    encoding_efficiency:  float
    num_symbols:          int
    # Optional extras stage2 may or may not return
    huffman_tree:         Any = None
    encoded_bits:         str | None = None
    symbol_frequencies:   Any = None

class DecompressRequest(BaseModel):
    compressed_bytes: str
    num_symbols:      int       # required by stage2 FGK decoder

class DecompressResponse(BaseModel):
    recovered_text: str

# ── Mock helpers ──────────────────────────────────────────────────────────────

def _mock_run() -> dict:
    return {
        "ocr_text":             "48392",
        "confidence":           0.97,
        "noise_profile_detected": "gaussian",
        "compressed_bytes":     base64.b64encode(b"mock-compressed-48392").decode(),
        "original_size_bits":   40,
        "compressed_size_bits": 22,
        "compression_ratio":    1.84,
        "entropy":              3.21,
        "encoding_efficiency":  0.93,
        "num_symbols":          5,
        "huffman_tree":         None,
        "encoded_bits":         None,
        "symbol_frequencies":   None,
        "pipeline_latency_ms":  142.3,
    }

# ── Internal helpers ──────────────────────────────────────────────────────────

async def _call_huffman_compress(text: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.post(f"{HUFFMAN_URL}/compress", json={"text": text})
            r.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise HTTPException(502, f"Huffman service unreachable: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Huffman service error {exc.response.status_code}") from exc
    return r.json()

def _save_image(user_id: int, image_bytes: bytes, filename: str) -> Path:
    user_dir = UPLOADS_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    ext  = Path(filename).suffix or ".bin"
    dest = user_dir / f"{uuid.uuid4().hex}{ext}"
    dest.write_bytes(image_bytes)
    return dest

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    if MOCK_STAGES:
        return {"orchestrator": "ok", "stage1_ocr": "mock", "stage2_huffman": "mock"}

    statuses: dict[str, str] = {"orchestrator": "ok"}
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in [("stage1_ocr", OCR_URL), ("stage2_huffman", HUFFMAN_URL)]:
            try:
                r = await client.get(f"{url}/health")
                statuses[name] = "ok" if r.status_code == 200 else "degraded"
            except Exception:
                statuses[name] = "unreachable"
    return statuses


@router.post("/pipeline/run")
async def pipeline_run(
    image: UploadFile = File(...),
    noise_profile: str = Form("none"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    image_bytes = await image.read()

    saved_path = _save_image(current_user.id, image_bytes, image.filename or "upload.bin")

    run = PipelineRun(
        user_id=current_user.id,
        image_filename=image.filename,
        image_path=str(saved_path),
        noise_profile=noise_profile,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    if MOCK_STAGES:
        result = _mock_run()
        result["run_id"] = run.id
        run.ocr_text               = result["ocr_text"]
        run.confidence             = result["confidence"]
        run.noise_profile_detected = result["noise_profile_detected"]
        run.compressed_bytes       = result["compressed_bytes"]
        run.original_size_bits     = result["original_size_bits"]
        run.compressed_size_bits   = result["compressed_size_bits"]
        run.compression_ratio      = result["compression_ratio"]
        run.entropy                = result["entropy"]
        run.encoding_efficiency    = result["encoding_efficiency"]
        run.num_symbols            = result["num_symbols"]
        run.pipeline_latency_ms    = result["pipeline_latency_ms"]
        db.commit()
        return result

    # ── Stage 1: OCR ─────────────────────────────────────────────────────────
    # stage1 uses "combined" for what the UI calls "both"; crumpled/stained pass through as-is
    stage1_noise = "combined" if noise_profile == "both" else noise_profile
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            ocr_resp = await client.post(
                f"{OCR_URL}/ocr",
                files={"image": (image.filename, image_bytes, image.content_type)},
                data={"noise_profile": stage1_noise, "run_id": str(run.id)},
            )
            ocr_resp.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise HTTPException(502, f"OCR service unreachable: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"OCR service error {exc.response.status_code}") from exc

    ocr_data = ocr_resp.json()
    ocr_text = ocr_data["text"]

    # ── Stage 2: Compress ─────────────────────────────────────────────────────
    comp_data = await _call_huffman_compress(ocr_text)

    latency_ms  = (time.perf_counter() - t0) * 1000
    num_symbols = len(ocr_text.encode("utf-8"))

    # ── Persist ───────────────────────────────────────────────────────────────
    run.ocr_text               = ocr_text
    run.confidence             = ocr_data.get("confidence", 0.0)
    run.noise_profile_detected = ocr_data.get("noise_profile_detected", noise_profile)
    run.compressed_bytes       = comp_data["compressed"]
    run.original_size_bits     = comp_data["original_size_bits"]
    run.compressed_size_bits   = comp_data["compressed_size_bits"]
    run.compression_ratio      = comp_data["compression_ratio"]
    run.entropy                = comp_data["entropy"]
    run.encoding_efficiency    = comp_data["encoding_efficiency"]
    run.num_symbols            = num_symbols
    run.huffman_tree           = str(comp_data.get("huffman_tree") or "")
    run.encoded_bits           = comp_data.get("encoded_bits") or ""
    run.symbol_frequencies     = str(comp_data.get("symbol_frequencies") or "")
    run.pipeline_latency_ms    = round(latency_ms, 2)
    db.commit()

    return {
        "run_id":                  run.id,
        "ocr_text":                run.ocr_text,
        "confidence":              run.confidence,
        "noise_profile_detected":  run.noise_profile_detected,
        "compressed_bytes":        run.compressed_bytes,
        "original_size_bits":      run.original_size_bits,
        "compressed_size_bits":    run.compressed_size_bits,
        "compression_ratio":       run.compression_ratio,
        "entropy":                 run.entropy,
        "encoding_efficiency":     run.encoding_efficiency,
        "num_symbols":             run.num_symbols,
        "huffman_tree":            comp_data.get("huffman_tree"),
        "encoded_bits":            comp_data.get("encoded_bits"),
        "symbol_frequencies":      comp_data.get("symbol_frequencies"),
        "pipeline_latency_ms":     run.pipeline_latency_ms,
        "denoised_image":          ocr_data.get("denoised_image"),
    }


@router.post("/pipeline/relay/ocr", response_model=RelayResponse)
async def relay_ocr_to_huffman(
    body: RelayRequest,
    x_stage_secret: str = Header(default=""),
    db: Session = Depends(get_db),
):
    expected_secret = os.getenv("STAGE_SECRET", "internal-secret")
    if x_stage_secret != expected_secret:
        raise HTTPException(403, "Invalid stage secret")

    run = db.query(PipelineRun).filter(PipelineRun.id == body.run_id).first()
    if not run:
        raise HTTPException(404, f"Run {body.run_id} not found")

    run.ocr_text               = body.text
    run.confidence             = body.confidence
    run.noise_profile_detected = body.noise_profile_detected
    db.commit()

    if MOCK_STAGES:
        mock = _mock_run()
        comp: dict = {k: mock[k] for k in ("compressed_bytes", "original_size_bits",
                                            "compressed_size_bits", "compression_ratio",
                                            "entropy", "encoding_efficiency")}
        comp["compressed"] = comp.pop("compressed_bytes")
    else:
        comp = await _call_huffman_compress(body.text)

    num_symbols = len(body.text.encode("utf-8"))

    run.compressed_bytes      = comp.get("compressed")
    run.original_size_bits    = comp.get("original_size_bits")
    run.compressed_size_bits  = comp.get("compressed_size_bits")
    run.compression_ratio     = comp.get("compression_ratio")
    run.entropy               = comp.get("entropy")
    run.encoding_efficiency   = comp.get("encoding_efficiency")
    run.num_symbols           = num_symbols
    db.commit()

    return RelayResponse(
        compressed_bytes=run.compressed_bytes or "",
        original_size_bits=run.original_size_bits or 0,
        compressed_size_bits=run.compressed_size_bits or 0,
        compression_ratio=run.compression_ratio or 0.0,
        entropy=run.entropy or 0.0,
        encoding_efficiency=run.encoding_efficiency or 0.0,
        num_symbols=num_symbols,
    )


@router.post("/pipeline/decompress", response_model=DecompressResponse)
async def pipeline_decompress(body: DecompressRequest):
    if MOCK_STAGES:
        return {"recovered_text": "48392"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.post(
                f"{HUFFMAN_URL}/decompress",
                json={"compressed": body.compressed_bytes, "num_symbols": body.num_symbols},
            )
            r.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise HTTPException(502, f"Huffman service unreachable: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Huffman service error {exc.response.status_code}") from exc

    return {"recovered_text": r.json()["text"]}


@router.get("/pipeline/runs/{run_id}/image")
def get_run_image(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.id == run_id, PipelineRun.user_id == current_user.id)
        .first()
    )
    if not run or not run.image_path:
        raise HTTPException(404, "Image not found")
    path = Path(run.image_path)
    if not path.exists():
        raise HTTPException(404, "Image file missing on disk")
    return FileResponse(str(path), media_type="image/*")

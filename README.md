# CodeNova — 2-Stage Neural OCR + Compression Pipeline

**IU Hackathon 2026** — A full-stack pipeline that ingests a noisy scanned document, extracts its text using a custom-trained CNN, and compresses the output using a hand-implemented Adaptive Huffman encoder — delivered as two communicating microservices.

---

## Pipeline Overview

```
Noisy Document Image
        │
        ▼
┌─────────────────────────┐
│   Stage 1 — OCR         │  FastAPI · port 8001
│                         │
│  UNet Denoiser          │  Residual U-Net, GroupNorm
│       ↓                 │  Trained on NoisyOffice dataset
│  Sauvola Binarization   │  Adaptive local thresholding
│       ↓                 │
│  Character Segmentation │  Contour-based + projection profile
│       ↓                 │
│  CharCNN (62 classes)   │  eMNIST byclass → Char74K fine-tune
│       ↓                 │
│  Extracted Text         │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Stage 2 — Compression │  Flask · port 8002
│                         │
│  FGK Adaptive Huffman   │  Built from scratch — no zlib/gzip
│       ↓                 │
│  Compressed Bitstream   │
│  + Metrics              │
│       ↓                 │
│  Lossless Decompression │  Verified on every run
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Orchestrator          │  FastAPI · port 8000
│   Frontend              │  React + Vite · port 3000
└─────────────────────────┘
```

---

## Architecture

```
frontend/          React 18 + TypeScript + Vite + Tailwind
orchestrator/      FastAPI — coordinates Stage 1 → Stage 2, SQLite persistence
stage1_ocr/        FastAPI — UNet denoiser + CharCNN recognition
stage2/            Flask  — FGK Adaptive Huffman encoder/decoder
```

---

## Stage 1 — OCR Microservice

### Step 1: U-Net Denoiser

A residual U-Net trained on the NoisyOffice dataset. Predicts the noise component and subtracts it from the input — learning small corrections rather than reconstructing the full image.

**Architecture:**
```
Input (1×H×W)
  → Enc1: ConvBlock(1→32,  GroupNorm) + MaxPool
  → Enc2: ConvBlock(32→64, GroupNorm) + MaxPool
  → Enc3: ConvBlock(64→128,GroupNorm) + MaxPool
  → Neck: ConvBlock(128→256)
  → Dec3: UpBlock(256→128) + skip from Enc3
  → Dec2: UpBlock(128→64)  + skip from Enc2
  → Dec1: UpBlock(64→32)   + skip from Enc1
  → Conv(32→1)
Output = clamp(input − predicted_noise, 0, 1)
```

**Design choices:**
- GroupNorm instead of BatchNorm — stable on small batch sizes at inference
- Residual noise subtraction — network learns only the noise, not the full image
- Bilinear upsample + 1×1 conv — smoother reconstruction than transposed convolutions
- Loss: 0.5×MSE + 0.5×(1−SSIM) — pixel accuracy + stroke preservation

**Noise profiles supported:**

| Profile | Preprocessing |
|---|---|
| None | Direct to CNN |
| Gaussian | Gaussian blur 3×3 |
| Salt & Pepper | Median blur 3×3 |
| Crumpled | CLAHE + sharpening |
| Stained | CLAHE + contrast normalization |
| All | Median → Gaussian → Bilateral |

### Step 2: Preprocessing + Segmentation

**Sauvola adaptive thresholding** (`window=25, k=0.2`) adapts to local lighting variations — critical for documents with uneven illumination or staining. Produces a binary image with white text on black background.

**Line segmentation** — horizontal projection profile counts ink pixels per row. Rows above threshold are inside a text line; empty rows mark gaps between lines.

**Character segmentation** — connected component analysis finds individual character blobs. Wide blobs are split using vertical projection valleys. Components closer than 3px horizontally are merged to handle split characters like dotted `i` and `j`.

**Space reconstruction** — dynamic gap threshold using jump detection in the gap distribution. Automatically adapts to different font sizes and DPI without hardcoded values.

### Step 3: CharCNN

```
Input (1×28×28)
  → Block 1: Conv(1→32)   + BN + ReLU × 2 → MaxPool → Dropout(0.10)
  → Block 2: Conv(32→64)  + BN + ReLU × 2 → MaxPool → Dropout(0.15)
  → Block 3: Conv(64→128) + BN + ReLU     → Dropout(0.20)
  → Flatten → Linear(6272→256) → ReLU → Dropout(0.30)
  → Linear(256→62)
Output: 62-class logits (0–9, A–Z, a–z)
```

**Training pipeline:**

**Phase 1 — eMNIST byclass pretraining:**
- Dataset: eMNIST `byclass` split — 62 classes, ~700k samples, fully case-sensitive
- Key fix: `rot90(k=3) + flip` transform corrects eMNIST storage transposition
- Why byclass: eMNIST `balanced` merges 15 letter pairs (C/c, I/i, O/o, S/s...) causing systematic case errors
- Optimizer: Adam (`lr=1e-3`, `weight_decay=1e-4`)
- Scheduler: ReduceLROnPlateau, early stopping patience=5
- **Result: 88.4% val accuracy**

**Phase 2 — Char74K fine-tuning:**
- Dataset: English/Fnt — 62,992 images, 62 classes, 1016 images/class, real font variety
- Two-phase fine-tuning:
  - Phase 1: freeze feature extractor, train head only (5 epochs, `lr=1e-3`)
  - Phase 2: unfreeze all layers, full fine-tune (20 epochs, `lr=1e-4`, CosineAnnealing, patience=5)
- Label smoothing=0.1, WeightedRandomSampler for class balance
- **Result: 92.5% val accuracy on Char74K**

**Why two-phase fine-tuning:**
- Phase 1 stabilises the classifier head before the backbone is unfrozen
- Prevents large early gradients from destroying the eMNIST-learned features
- Phase 2 makes small targeted adjustments to the feature extractor for real font styles

---

## Stage 2 — Adaptive Huffman Compression

The FGK (Faller–Gallager–Knuth) Adaptive Huffman algorithm implemented entirely from scratch. No `zlib`, `gzip`, `bz2`, or any compression library.

**How it works:**
Unlike standard Huffman, FGK builds the tree online — one byte at a time. A NYT (Not Yet Transmitted) sentinel node handles new symbols. After each symbol the tree rebalances by swapping nodes to maintain the sibling property, keeping encoder and decoder in sync with zero lookahead.

**Metrics reported:**

| Metric | Formula |
|---|---|
| `compression_ratio` | `original_bits / compressed_bits` |
| `entropy` | `−Σ p(x) log₂ p(x)` over byte frequencies |
| `encoding_efficiency` | `entropy / avg_bits_per_symbol` |

**Lossless verification:** Every pipeline run decompresses the output and verifies character-for-character match with the original text.

---

## Performance

| Metric | Value |
|---|---|
| CharCNN accuracy (eMNIST byclass) | 88.4% |
| CharCNN accuracy (Char74K fine-tuned) | 92.5% |
| Character accuracy on NoisyOffice printed docs | ~88.5% |
| Character Error Rate (CER) | ~11.5% |
| Compression ratio (typical) | 1.5–2.1× |
| Encoding efficiency | ~85–90% |
| Pipeline latency (CPU, Mac M1) | ~1–2 seconds |

---

## Project Structure

```
codenova/
├── start.sh                      ← starts all 3 backend services
├── stop.sh                       ← stops all services
├── requirements.txt              ← root common dependencies
│
├── stage1_ocr/
│   ├── service.py                ← FastAPI OCR service
│   ├── unet_denoiser_best.pth    ← U-Net weights (download from Drive)
│   ├── char74k_finetuned_cnn.pth ← CharCNN weights (download from Drive)
│   └── requirements.txt
│
├── stage2/
│   ├── app.py                    ← Flask Huffman service
│   ├── huffman.py                ← FGK encoder + decoder (from scratch)
│   ├── metrics.py                ← compression metrics
│   └── requirements.txt
│
├── orchestrator/
│   ├── main.py                   ← FastAPI orchestrator
│   ├── routers/pipeline.py       ← pipeline coordination
│   ├── auth.py                   ← JWT auth
│   ├── models.py                 ← SQLAlchemy ORM
│   ├── database.py               ← SQLite setup
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── App.tsx               ← main UI (5-step pipeline flow)
        └── api.ts                ← API client
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Model weights in `stage1_ocr/`:
  - `unet_denoiser_best.pth`
  - `char74k_finetuned_cnn.pth`

Download weights from Google Drive:
```
https://drive.google.com/drive/folders/[your-ocr-folder]
```

### Install dependencies

```bash
# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r stage1_ocr/requirements.txt
pip install -r stage2/requirements.txt
pip install -r orchestrator/requirements.txt

# Frontend
cd frontend && npm install
```

### Environment setup

```bash
echo "SECRET_KEY=your-secret-key-here" > orchestrator/.env
```

### Start

```bash
# Backend (all 3 services)
chmod +x start.sh
./start.sh

# Frontend (separate terminal)
cd frontend && npm run dev
```

Open `http://localhost:3000`

### Stop

```bash
./stop.sh
```

---

## API Reference

### Stage 1 — OCR (`localhost:8001`)

```
POST /ocr
  Body: multipart/form-data
    image: <file>
    noise_profile: none | gaussian | salt_and_pepper | crumpled | stained | combined

  Returns:
    text: string
    confidence: float (0–1)
    denoised_image: base64 PNG

GET /health → { "status": "ok" }
```

### Stage 2 — Huffman (`localhost:8002`)

```
POST /compress
  Body: { "text": "..." }
  Returns:
    compressed: base64 string
    original_size_bits: int
    compressed_size_bits: int
    compression_ratio: float
    entropy: float
    encoding_efficiency: float

POST /decompress
  Body: { "compressed": "<base64>", "num_symbols": int }
  Returns: { "text": "recovered text" }

GET /health → { "status": "ok" }
```

### Orchestrator (`localhost:8000`)

```
POST /pipeline/run
  Body: multipart/form-data — image + noise_profile
  Returns: full pipeline result with all metrics

POST /pipeline/decompress
  Body: { "compressed_bytes": "<base64>", "num_symbols": int }
  Returns: { "recovered_text": "..." }

GET /health → { "orchestrator": "ok", "stage1_ocr": "ok", "stage2_huffman": "ok" }
```

---

## Deliverables Checklist

- [x] Stage 1 — CNN OCR microservice (`stage1_ocr/service.py`)
- [x] Stage 2 — Adaptive Huffman microservice (`stage2/`)
- [x] Trained model weights — `unet_denoiser_best.pth`, `char74k_finetuned_cnn.pth`
- [x] README with setup instructions
- [x] Lossless decompression verified on every run
- [x] CNN architecture documented with design justification
- [x] Multi-noise-profile support (6 profiles)
- [x] Compression metrics — ratio, entropy, encoding efficiency
- [x] End-to-end latency benchmarked (`pipeline_latency_ms`)
- [x] Char74K fine-tuning for real document generalization

---

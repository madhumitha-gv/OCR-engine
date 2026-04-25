# Neural OCR Compression Pipeline

> **IU Hackathon 2026** · Built in 24 hours by Team CodeNova

**Noisy document in. Clean compressed text out.**

This project is a two-stage neural pipeline that takes a blurry, distorted scanned document, denoises it with a custom-trained U-Net CNN, reads the text with TrOCR, and compresses the output using a hand-implemented Adaptive Huffman encoder  all exposed as communicating microservices with a real-time React dashboard.

---

## 🎬 Presentation

[▶ Watch the demo](https://www.youtube.com/watch?v=3fcLQcOCGw4)

---

## The Problem

Scanned documents come out noisy. Blurry text, crumpled paper, stains, faded ink, standard OCR fails on all of it. And even when you get clean text out, you still need to store or transmit it efficiently.

**We built the CNN OCR + compression/decompression pipeline that handles both**

---

## What It Does

| Step | What happens |
|------|-------------|
| 1 | Upload a noisy scanned document |
| 2 | Select noise profile (Gaussian, Salt & Pepper, Crumpled, Stained) |
| 3 | U-Net CNN denoises the image |
| 4 | TrOCR reads the cleaned text line by line |
| 5 | Adaptive Huffman (FGK) compresses the output |
| 6 | Dashboard shows denoised image, extracted text, Huffman tree, and all metrics |
| 7 | One-click lossless decompression verification |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REACT DASHBOARD  :3000                       │
│   Image Upload · Noise Selector · Metrics · Huffman Tree Viewer     │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP multipart/form-data
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR  FastAPI  :8000                        │
│         JWT Auth · SQLite · Pipeline Coordinator · Run History      │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │ POST /ocr                        │ POST /compress
               ▼                                  ▼
┌──────────────────────────┐      ┌───────────────────────────────────┐
│  STAGE 1 — OCR  :8001    │      │  STAGE 2 — HUFFMAN  :8002         │
│                          │      │                                   │
│  1. Classical filter     │      │  FGK Adaptive Huffman             │
│     (per noise profile)  │      │  — built from scratch             │
│  2. U-Net DenoisingCNN   │      │  — no zlib / gzip                 │
│  3. Line segmentation    │      │                                   │
│     (OpenCV projection)  │      │  Returns: compressed bytes,       │
│  4. TrOCR inference      │      │  ratio, entropy, efficiency,      │
│                          │      │  Huffman tree JSON, bit string    │
└──────────────────────────┘      └───────────────────────────────────┘
```

**Training data:** NoisyOffice dataset — 72 simulated noisy/clean document pairs across Gaussian, fold, crumple, wrinkle, and pepper noise profiles.

---

## Algorithms

### U-Net Denoising CNN
Custom encoder-decoder with skip connections, trained from scratch on NoisyOffice:

Input (1×H×W)
  → Enc1: Conv(1→32)  + BN + ReLU ×2  → Pool
  → Enc2: Conv(32→64) + BN + ReLU ×2  → Pool
  → Enc3: Conv(64→128)+ BN + ReLU ×2  ← bottleneck
  → UpConv(128→64) + skip(Enc2) → Dec2: Conv(128→64) ×2
  → UpConv(64→32)  + skip(Enc1) → Dec1: Conv(64→32)  ×2
  → Conv(32→1) + Sigmoid
Output (1×H×W)


### CRNN (from scratch)
Built independently to demonstrate architectural understanding:

Input (1×32×W)
  → CNN blocks: 64 → 128 → 256 → 512 filters
     (MaxPool collapses height to 1, width becomes time axis)
  → Bidirectional LSTM ×2 layers (hidden=256)
  → Linear → Log-Softmax
  → CTC decoder (greedy)
Output: text string — no character segmentation needed

Trained on synthesized eMNIST word sequences (200k samples, A100 GPU).

### Adaptive Huffman FGK
Implemented entirely from scratch — no compression libraries used:
- Builds frequency tree live, one symbol at a time
- NYT sentinel node handles new symbols
- Sibling property maintained after every update
- Encoder and decoder stay in sync with zero lookahead
- 100% lossless — verified on every run

---

## Benchmarks

| Component | Metric | Result |
|-----------|--------|--------|
| U-Net — Noisec (crumple) | PSNR | 43.88 dB |
| U-Net — Noisef (fold)    | PSNR | 43.15 dB |
| U-Net — Noisew (wrinkle) | PSNR | 41.34 dB |
| U-Net — Noisep (pepper)  | PSNR | 44.45 dB |
| CRNN OCR | Character accuracy | 90 % |
| Huffman | Lossless recovery | 100% |
| Pipeline | End-to-end latency | 0-20 ms |
<img width="350" height="350" alt="image" src="https://github.com/user-attachments/assets/6c4452f5-4dee-4f12-94bf-60a83c5e9e43" />

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- `denoising_weights.pth` in `stage1_ocr/`

### One command
```bash
./start.sh
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

### Manual (per service)
```bash
# Stage 1 — OCR
cd stage1_ocr && uvicorn service:app --port 8001 --reload

# Stage 2 — Huffman
cd stage2 && python3 app.py

# Orchestrator
cd orchestrator && uvicorn main:app --port 8000 --reload

# Frontend
cd frontend && npm run dev
```

### First run
1. Open `http://localhost:3000`
2. Register an account
3. Upload a noisy document image
4. Select noise profile → click **Run Pipeline**
5. View denoised image, extracted text, Huffman tree, metrics

---

## Project Structure

```
codenova/
├── start.sh / stop.sh            # One-command launch & teardown
│
├── orchestrator/                 # FastAPI · JWT auth · SQLite · coordinator
│   ├── main.py
│   ├── auth.py                   # bcrypt + JWT
│   ├── models.py                 # User, PipelineRun ORM
│   └── routers/
│       ├── pipeline.py           # /pipeline/run, /decompress
│       ├── auth.py
│       └── users.py
│
├── stage1_ocr/                   # FastAPI OCR microservice
│   ├── service.py                # U-Net + line segmentation + TrOCR
│   └── denoising_weights.pth     # Trained model weights
│
├── stage2/                       # Flask Huffman microservice
│   ├── huffman.py                # FGK Adaptive Huffman — from scratch
│   ├── app.py                    # /compress, /decompress endpoints
│   └── metrics.py                # ratio, entropy, efficiency
│
├── crnn_ocr/                     # From-scratch CRNN implementation
│   ├── crnn_emnist.py            # Model + eMNIST synthesizer + training
│   ├── line_segmentation.py      # OpenCV horizontal projection segmenter
│   └── crnn_emnist_best.pth      # Trained weights
│
└── frontend/                     # React 18 + TypeScript + Vite + Tailwind
    └── src/
        ├── App.tsx
        ├── api.ts
        └── components/
            ├── ImageUploader.tsx
            ├── NoiseSelector.tsx
            ├── MetricsGrid.tsx
            ├── CompressionVisualizer.tsx
            ├── PipelineDiagram.tsx
            └── HistoryDrawer.tsx
```

---

## API Reference

### `POST /pipeline/run`
```
Authorization: Bearer <token>
Content-Type: multipart/form-data

image: <file>
noise_profile: none | gaussian | salt_and_pepper | crumpled | stained | both
```
Returns extracted text, denoised image (base64), compressed bytes, Huffman tree, and all metrics.

### `POST /pipeline/decompress`
```json
{ "compressed_bytes": "<base64>", "num_symbols": 5 }
```
Returns `{ "recovered_text": "..." }` — lossless verification.

### `GET /health`
```json
{ "orchestrator": "ok", "stage1_ocr": "ok", "stage2_huffman": "ok" }
```

---

## Noise Profiles

| Profile | Preprocessing before CNN |
|---------|--------------------------|
| `gaussian` | Gaussian blur 3×3 |
| `salt_and_pepper` | Median blur 3×3 |
| `crumpled` | CLAHE (clip=2.0) → Sharpening |
| `stained` | CLAHE (clip=3.5) → Contrast normalization |
| `both` | Median → Gaussian → Bilateral filter |

---

## Environment Variables

```bash
# orchestrator/.env
SECRET_KEY=your-long-random-key
MOCK_STAGES=false
OCR_URL=http://localhost:8001
HUFFMAN_URL=http://localhost:8002

# frontend/.env.local
VITE_MOCK_API=false
VITE_API_URL=http://localhost:8000
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Training | PyTorch · A100 GPU |
| Denoising | Custom U-Net CNN · NoisyOffice dataset |
| OCR | TrOCR · Custom CRNN (from scratch) |
| Compression | Adaptive Huffman FGK (from scratch) |
| Line segmentation | OpenCV horizontal projection profiling |
| Backend | FastAPI (orchestrator + OCR) · Flask (Huffman) |
| Auth | JWT · bcrypt |
| Database | SQLite · SQLAlchemy |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |

---



## License

All rights retained by the team per IU Hackathon 2026 IP policy.

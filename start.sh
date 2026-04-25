#!/bin/bash
# CodeNova — start all services
# Usage: ./start.sh
# Stop:  ./stop.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting CodeNova services..."

# Stage 1 — Real OCR (port 8001)
cd "$ROOT/stage1_ocr"
uvicorn service:app --port 8001 --reload &
STAGE1_PID=$!
echo "Stage 1 (OCR)      → http://localhost:8001  [PID $STAGE1_PID]"

# Stage 2 — Real Huffman (port 8002)
cd "$ROOT/stage2"
python3 app.py &
STAGE2_PID=$!
echo "Stage 2 (Huffman)  → http://localhost:8002  [PID $STAGE2_PID]"

# Orchestrator (port 8000)
cd "$ROOT/orchestrator"
uvicorn main:app --port 8000 --reload &
ORCH_PID=$!
echo "Orchestrator       → http://localhost:8000  [PID $ORCH_PID]"

# Save PIDs for stop script
echo "$STAGE1_PID $STAGE2_PID $ORCH_PID" > "$ROOT/.pids"

echo ""
echo "All services running. API docs → http://localhost:8000/docs"
echo "Run 'cd frontend && npm run dev' to start the UI."
echo "Run ./stop.sh to stop everything."

wait

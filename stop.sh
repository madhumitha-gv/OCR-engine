#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$ROOT/.pids" ]; then
  kill $(cat "$ROOT/.pids") 2>/dev/null
  rm "$ROOT/.pids"
fi
# Also kill anything still holding the ports
kill $(lsof -ti:8000) $(lsof -ti:8001) $(lsof -ti:8002) 2>/dev/null
echo "All services stopped."

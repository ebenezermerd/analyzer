#!/bin/bash
# Start both backend and frontend for Issue Finder Web

echo "Starting Issue Finder Web..."
echo ""

# Start backend
echo "Starting FastAPI backend on :8000..."
cd /Users/tsin/Developer/issue-finder-web/backend
/Users/tsin/Developer/analyzer/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting Next.js frontend on :3000..."
cd /Users/tsin/Developer/issue-finder-web/frontend
pnpm dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait

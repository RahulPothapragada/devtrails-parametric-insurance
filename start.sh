#!/bin/bash
# FlowSecure — start backend + frontend together

cleanup() {
  echo ""
  echo "Stopping FlowSecure..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "🚀 Starting FlowSecure..."
echo ""

# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ Backend  → http://localhost:8000"
echo "   API docs → http://localhost:8000/docs"

# Frontend
cd ../frontend
npm run dev -- --port 5173 &
FRONTEND_PID=$!
echo "✅ Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

wait $BACKEND_PID $FRONTEND_PID

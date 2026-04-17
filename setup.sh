#!/bin/bash
# FlowSecure — one-time setup
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "Setting up FlowSecure..."

# Backend
echo ""
echo "Installing backend dependencies..."
cd "$ROOT/backend"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q

# Copy .env if missing
if [ ! -f "$ROOT/backend/.env" ] && [ -f "$ROOT/backend/.env.example" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "Created backend/.env from .env.example"
fi
echo "Backend ready"

# Frontend
echo ""
echo "Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install --silent

# Copy .env if missing
if [ ! -f "$ROOT/frontend/.env" ] && [ -f "$ROOT/frontend/.env.example" ]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
  echo "Created frontend/.env from .env.example"
fi
echo "Frontend ready"

echo ""
echo "Setup complete. Run ./start.sh to launch."

#!/bin/bash
# FlowSecure — one-time setup
set -e

echo "🔧 Setting up FlowSecure..."

# Backend
echo ""
echo "📦 Installing backend dependencies..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
echo "✅ Backend ready"

# Frontend
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install --silent
echo "✅ Frontend ready"

echo ""
echo "✅ Setup complete. Run ./start.sh to launch."

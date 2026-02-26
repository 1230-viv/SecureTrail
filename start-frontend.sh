#!/bin/bash
# SecureTrail Frontend Startup Script

echo "🎨 Starting SecureTrail Frontend..."
echo "==================================="

cd "$(dirname "$0")/Frontend"

echo "✅ Starting Vite dev server on http://localhost:5173"
echo ""

npm run dev

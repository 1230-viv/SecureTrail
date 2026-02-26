#!/bin/bash
# SecureTrail Backend Startup Script

echo "🚀 Starting SecureTrail Backend..."
echo "=================================="

# Activate conda environment and start the server
cd "$(dirname "$0")/Backend"

# Use eval to properly activate conda in bash
eval "$(~/miniconda3/bin/conda shell.bash hook)"
conda activate securetrail

echo "✅ Conda environment activated"
echo "🔧 Starting FastAPI server on http://localhost:8000"
echo ""

python main.py

#!/bin/bash
# Backend startup script for HireSense AI

set -e

echo "🚀 HireSense AI Backend Startup"
echo "================================"

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
echo "✓ Activating virtual environment"
source .venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Download spacy model if needed
echo "📚 Ensuring NLP models are available..."
python -m spacy download en_core_web_sm 2>/dev/null || true

# Setup database
echo "🗄️  Setting up database..."
mkdir -p data/uploads

# Check if .env exists, if not create from example
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚙️  Creating .env from .env.example..."
        cp .env.example .env
        echo "   ℹ️  Edit .env to customize settings (especially TESSERACT_CMD if using OCR)"
    fi
fi

# Start the server
echo ""
echo "✅ Backend ready!"
echo ""
echo "Starting server on http://127.0.0.1:8000"
echo "📖 API docs: http://127.0.0.1:8000/docs"
echo "💚 Health check: http://127.0.0.1:8000/health"
echo ""
echo "Press CTRL+C to stop"
echo "================================"
echo ""

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

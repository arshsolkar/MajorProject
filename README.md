# HireSense AI

HireSense AI is a recruitment application with a React/Vite frontend and a FastAPI backend. The backend uses SQLite by default for local development and stores uploaded resumes under its configured upload directory.

## Prerequisites

- Git
- Node.js 20.19+ or 22.12+ and npm
- Python 3.11 or 3.12 (64-bit)
- Tesseract OCR is optional; install it only if you need OCR for scanned PDF resumes

## Run from scratch

Open two terminals in the project directory: one for the backend and one for the frontend. Start the backend first. The Vite development server runs at `http://localhost:8443` and proxies `/api` requests to the API at `http://127.0.0.1:8000`.

### Windows (PowerShell)

In Terminal 1, install and start the backend:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
python -m spacy download en_core_web_sm
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, use the environment's interpreter directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m spacy download en_core_web_sm
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In Terminal 2, install and start the frontend:

```powershell
npm install
npm run dev
```

### macOS and Linux

In Terminal 1, install and start the backend:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
python -m spacy download en_core_web_sm
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In Terminal 2, from the project root, install and start the frontend:

```bash
npm install
npm run dev
```

Open `http://localhost:8443` in your browser. The API health check is available at `http://127.0.0.1:8000/health`.

## Backend environment

The backend reads process environment variables and the repository-root `.env` or `backend/.env` files. Copy `backend/.env.example` to `backend/.env` and set the values you need. Keep `.env` files private; they are excluded from Git. Gmail SMTP details and safe setup checks are documented in [backend/README.md](backend/README.md).

The backend defaults to a local SQLite database and a local uploads directory. Uploaded resumes and database files are runtime data, not source code; do not commit real applicant records or credentials.

## Production frontend build

```bash
npm run build
```

The generated frontend assets are written to `dist/`.

## Optional: PostgreSQL with Docker Compose

Copy the safe template to a root `.env` file and replace its placeholder with a random password. For example, macOS/Linux can generate one with `openssl rand -hex 24`; in PowerShell use `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))`. Then start the containers with `docker compose up --build`. The root `.env` is local-only and must never be committed.

# PrepFella

AI mock interviews that adapt to your role, your resume and every answer you give. Built for Codefest.

**Plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) · **Pitch deck:** `Prepfella.pptx` · **Brand assets:** `logos/`

## Quick start (Windows)

```powershell
copy .env.example .env                 # then paste your NVIDIA_API_KEY from build.nvidia.com

# backend (Python 3.12 venv already in .venv; recreate with: py -3.12 -m venv .venv)
.venv\Scripts\python -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python -m scripts.smoke_test     # checks key, Nemotron models, TTS, ASR
..\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/health
# Data lives in backend\prepfella.db (SQLite, created on first start with 3 demo accounts). Delete it to reset.
```

```powershell
# frontend (second terminal)
cd frontend
npm install
npm run dev          # → http://localhost:3000 (pick a demo account)
```

Backend tests: `cd backend; ..\.venv\Scripts\python -m pytest tests`. Run uvicorn with a single worker: the NVIDIA rate-limit budget is per process.

## Design tools

`design-tools/` regenerates the logos and the pitch deck:

```powershell
cd design-tools
npm install
npm run logos      # → ../logos
$env:NODE_PATH = "$PWD\node_modules"; npm run deck   # → ../Prepfella.pptx
```

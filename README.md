# SkyPath

SkyPath is a take-home project scaffold for a flight discovery experience. This initial commit contains the application foundation only; flight search is intentionally not implemented yet.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Python, FastAPI, Uvicorn
- Local orchestration: Docker Compose

## Project structure

```text
skypath/
├── backend/       FastAPI application
├── frontend/      React application
└── compose.yaml   Local development services
```

## Run with Docker

Prerequisite: Docker Desktop or another Docker Compose-compatible runtime.

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Frontend: http://localhost:5173
- Backend health check: http://localhost:8000/health
- API documentation: http://localhost:8000/docs

Stop the services with `docker compose down`.

## Run locally without Docker

### Backend

Requires Python 3.12+.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

## Available checks

```bash
cd backend && pytest
cd frontend && npm run lint && npm run build
```


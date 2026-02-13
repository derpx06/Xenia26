# Xenia26

Xenia26 is a multi-service AI outreach platform:
- `Frontend/`: React chat UI with outreach channel preview cards (Email, LinkedIn, WhatsApp).
- `backend/`: Node/Express API for auth, contacts, user profile, and send actions.
- `fastapi/`: FastAPI + LangGraph agent system for research, drafting, streaming, and TTS.

For full design details, see:
- `PROJECT_ARCHITECTURE.md`
- `fastapi/ml/application/agent/ARCHITECTURE.md`

## What The Project Does

Xenia26 helps generate personalized outreach using:
- Contact-aware `@mention` context injection.
- Multi-channel draft generation (email, LinkedIn DM, WhatsApp, SMS, etc.).
- Critic/revision flow to improve quality.
- Optional voice generation for drafted content.
- Persisted threads and user/contact data.

## Repository Structure

```text
Xenia26/
  Frontend/    # React + Vite UI
  backend/     # Express + MongoDB APIs
  fastapi/     # FastAPI ML/Agent services
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- `uv` (Python package manager)
- MongoDB (local or cloud)
- Ollama (required for live local LLM generation)

## Environment Setup

### 1) Backend (`backend/.env`)

Create `backend/.env` (or keep `.env.temp` as fallback) with your own values:

```env
MONGO_URI=mongodb://localhost:27017/your_db
PORT=8080
MAIL_USER=your_email@example.com
EMAIL_PASS=your_app_password
```

### 2) FastAPI (`fastapi/.env`)

Copy and edit:

```bash
cp fastapi/.env.example fastapi/.env
```

At minimum, set:
- `MONGO_URI`
- `DATABASE_NAME`
- `MODEL_NAME` (Ollama model)

### 3) Frontend (`Frontend/.env`)

Verify:

```env
VITE_API_URL=http://localhost:8000
VITE_ASSISTANT_ID=agent
```

## Install Dependencies

### Frontend

```bash
cd Frontend
npm install
```

### Backend

```bash
cd backend
npm install
```

### FastAPI

```bash
cd fastapi
uv sync
```

## Run The Project (3 Terminals)

### Terminal 1: FastAPI agent server

```bash
cd fastapi
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: Node backend

```bash
cd backend
npm run dev
```

### Terminal 3: Frontend

```bash
cd Frontend
npm run dev
```

Default URLs:
- Frontend: `http://localhost:5173`
- FastAPI: `http://localhost:8000`
- Backend: `http://localhost:8080`

## Optional: Ollama Setup

Install/start Ollama, then pull the model referenced by `MODEL_NAME` in `fastapi/.env`.

Example:

```bash
ollama serve
ollama pull qwen2.5:7b
```

If Ollama is missing, agent fallback responses may still work, but full generation quality/features are reduced.

## Quick Smoke Test

```bash
curl http://localhost:8000/
```

Expected:

```json
{"message":"Xenia26 Backend API","status":"running","agent_endpoint":"/ml/agent/chat"}
```

## Notes

- Do not commit real credentials to `.env` files.
- The project supports both real-time streaming and sync draft responses.
- UI renders channel drafts with dedicated preview cards for cleaner send workflows.

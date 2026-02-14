import os
import warnings
from pathlib import Path
from dotenv import load_dotenv

# Suppress deprecation warnings from dependencies (Python 3.14 compatibility issues)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="langchain_core")

# Load project environment variables from fastapi/.env
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Set USER_AGENT if not already set
if not os.environ.get("USER_AGENT"):
    os.environ["USER_AGENT"] = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from ml.routes import router as ml_router

from contextlib import asynccontextmanager
from ml.infrastructure.db.sqlite import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables
    create_db_and_tables()
    yield

app = FastAPI(
    title="Xenia26 Backend API",
    description="Backend API with LangGraph Agent integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default port
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:3000",  # Alternative frontend port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ML router
app.include_router(ml_router)

# Serve static files for audio drafts
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return {
        "message": "Xenia26 Backend API",
        "status": "running",
        "agent_endpoint": "/ml/agent/chat"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

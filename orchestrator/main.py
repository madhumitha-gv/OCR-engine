"""
NeuralPress Orchestrator — entry point.
Mounts auth, user, and pipeline routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import Base, engine
from routers import auth, users, pipeline   # noqa: E402  (imports after load_dotenv)

# Create all tables on startup (SQLite auto-migration)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CodeNova API",
    description="Orchestrates the OCR → Huffman pipeline with user auth and run history.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(pipeline.router)

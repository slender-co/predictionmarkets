import sys
import os
from pathlib import Path

# Add backend directory to path so engine/models/etc. can be imported
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from sqlalchemy.orm import Session as DbSession
from database import engine, SessionLocal, Base, get_db
from models import ModelSettings, CalibrationLog

from routers import sessions, terms, base_rates, analysis, settings
from routers.source_events import router as source_events_router
from schemas import CalibrationLogResponse

app = FastAPI(
    title="Prediction Market Stat Arb Engine",
    description="Statistical arbitrage engine for political mention markets",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(terms.router)
app.include_router(base_rates.router)
app.include_router(analysis.router)
app.include_router(settings.router)
app.include_router(source_events_router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.get(ModelSettings, 1)
        if not existing:
            db.add(ModelSettings(id=1))
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/calibration", response_model=list[CalibrationLogResponse])
def list_calibration_logs(
    limit: int = Query(50, ge=1, le=200),
    db: DbSession = Depends(get_db),
):
    return db.query(CalibrationLog).order_by(CalibrationLog.created_at.desc()).limit(limit).all()


# --- Production: serve built React frontend ---
STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA — all non-API routes return index.html."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))

"""
Padel Coach AI - FastAPI Backend
Analyzes padel match videos using Google Gemini API
"""

import os
import uuid
import hashlib
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Depends, Cookie, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from pydantic import BaseModel

import database as db
from models import (
    AnalyzeRequest,
    AnalyzeResponse,
    StatusResponse,
    HistoryResponse,
    HistoryItem,
)
from tasks import task_manager, estimate_eta
from gemini_service import validate_youtube_url, extract_video_id

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ACCESS_PASSWORD = os.getenv("ACCESS_PASSWORD", "")
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))

# Session storage (in production, use Redis)
active_sessions: dict[str, datetime] = {}
SESSION_DURATION = timedelta(hours=24)


class LoginRequest(BaseModel):
    password: str


def hash_password(password: str) -> str:
    """Hash password for comparison"""
    return hashlib.sha256(password.encode()).hexdigest()


def create_session() -> str:
    """Create a new session token"""
    token = secrets.token_urlsafe(32)
    active_sessions[token] = datetime.utcnow() + SESSION_DURATION
    return token


def verify_session(session_token: Optional[str]) -> bool:
    """Verify if session is valid"""
    if not session_token:
        return False
    expiry = active_sessions.get(session_token)
    if not expiry:
        return False
    if datetime.utcnow() > expiry:
        del active_sessions[session_token]
        return False
    return True


async def require_auth(session: Optional[str] = Cookie(default=None, alias="padel_session")):
    """Dependency to require authentication"""
    if not ACCESS_PASSWORD:
        # No password set, allow access
        return True
    if not verify_session(session):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    await db.init_db()

    if GEMINI_API_KEY:
        task_manager.initialize(GEMINI_API_KEY)
        print("✓ Gemini API initialized")
    else:
        print("⚠ GEMINI_API_KEY not set - analysis will fail")

    if ACCESS_PASSWORD:
        print("✓ Password protection enabled")
    else:
        print("⚠ ACCESS_PASSWORD not set - no password protection")

    yield

    # Shutdown
    for task_id in list(task_manager.running_tasks.keys()):
        task_manager.cancel_task(task_id)


app = FastAPI(
    title="Padel Coach AI",
    description="AI-powered padel match analysis using video",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth Routes

@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response):
    """Login with password"""
    if not ACCESS_PASSWORD:
        # No password required
        return {"success": True, "message": "Пароль не требуется"}

    if request.password == ACCESS_PASSWORD:
        token = create_session()
        response.set_cookie(
            key="padel_session",
            value=token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=int(SESSION_DURATION.total_seconds())
        )
        return {"success": True, "message": "Добро пожаловать!"}

    raise HTTPException(status_code=401, detail="Неверный пароль")


@app.post("/api/auth/logout")
async def logout(response: Response, session: Optional[str] = Cookie(default=None, alias="padel_session")):
    """Logout and clear session"""
    if session and session in active_sessions:
        del active_sessions[session]
    response.delete_cookie("padel_session")
    return {"success": True}


@app.get("/api/auth/check")
async def check_auth(session: Optional[str] = Cookie(default=None, alias="padel_session")):
    """Check if user is authenticated"""
    if not ACCESS_PASSWORD:
        return {"authenticated": True, "password_required": False}
    return {
        "authenticated": verify_session(session),
        "password_required": True
    }


# Protected API Routes

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest, _: bool = Depends(require_auth)):
    """Start analysis of a padel match video"""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Сервис временно недоступен: API ключ не настроен"
        )

    try:
        validate_youtube_url(request.youtube_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    video_id = extract_video_id(request.youtube_url)
    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Не удалось извлечь ID видео из URL"
        )

    task_id = str(uuid.uuid4())
    await db.create_analysis(task_id, request.youtube_url, request.player_count)
    await task_manager.start_analysis(task_id, request.youtube_url)

    return AnalyzeResponse(
        task_id=task_id,
        status="processing",
        message="Анализ запущен. Это может занять 5-10 минут."
    )


@app.get("/api/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str, _: bool = Depends(require_auth)):
    """Get the status of an analysis task"""
    analysis = await db.get_analysis(task_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Анализ не найден")

    eta = await estimate_eta(analysis["progress"]) if analysis["status"] == "processing" else None

    return StatusResponse(
        task_id=task_id,
        status=analysis["status"],
        progress=analysis["progress"],
        eta_seconds=eta,
        error_message=analysis.get("error_message"),
    )


@app.get("/api/result/{task_id}")
async def get_result(task_id: str, _: bool = Depends(require_auth)):
    """Get the full analysis result"""
    analysis = await db.get_analysis(task_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Анализ не найден")

    if analysis["status"] in ("processing", "queued"):
        raise HTTPException(
            status_code=202,
            detail="Анализ ещё выполняется",
            headers={"Retry-After": "30"}
        )

    if analysis["status"] == "failed":
        raise HTTPException(
            status_code=500,
            detail=analysis.get("error_message", "Анализ завершился с ошибкой")
        )

    result = analysis.get("result_json")
    if not result:
        raise HTTPException(status_code=500, detail="Результат анализа отсутствует")

    return {
        "task_id": task_id,
        "youtube_url": analysis["youtube_url"],
        "created_at": analysis["created_at"],
        "completed_at": analysis["completed_at"],
        "analysis": result,
    }


@app.get("/api/history", response_model=HistoryResponse)
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: bool = Depends(require_auth)
):
    """Get analysis history"""
    items = await db.get_analysis_history(limit, offset)
    total = await db.get_history_count()

    history_items = [
        HistoryItem(
            task_id=item["task_id"],
            youtube_url=item["youtube_url"],
            status=item["status"],
            created_at=item["created_at"],
            completed_at=item.get("completed_at"),
            match_summary=item.get("match_summary"),
        )
        for item in items
    ]

    return HistoryResponse(items=history_items, total=total)


@app.delete("/api/analysis/{task_id}")
async def delete_analysis(task_id: str, _: bool = Depends(require_auth)):
    """Delete an analysis record"""
    task_manager.cancel_task(task_id)
    deleted = await db.delete_analysis(task_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Анализ не найден")

    return {"message": "Анализ удалён", "task_id": task_id}


@app.get("/api/health")
async def health_check():
    """Health check endpoint (public)"""
    return {
        "status": "ok",
        "gemini_configured": bool(GEMINI_API_KEY),
        "password_protected": bool(ACCESS_PASSWORD),
        "running_tasks": task_manager.get_running_tasks_count(),
    }


# Serve frontend
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @app.get("/")
    async def serve_frontend():
        """Serve the frontend application"""
        return FileResponse(os.path.join(frontend_path, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

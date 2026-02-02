"""
Padel Coach AI - FastAPI Backend
Analyzes padel match videos using Google Gemini API
"""

import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

import database as db
from models import (
    AnalyzeRequest,
    AnalyzeResponse,
    StatusResponse,
    HistoryResponse,
    HistoryItem,
    AnalysisResult,
)
from tasks import task_manager, estimate_eta
from gemini_service import validate_youtube_url, extract_video_id

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


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

    yield

    # Shutdown
    # Cancel any running tasks
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
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Routes

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest):
    """
    Start analysis of a padel match video

    - **youtube_url**: Public YouTube video URL
    - **player_count**: Number of players (default: 4)
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Сервис временно недоступен: API ключ не настроен"
        )

    # Validate YouTube URL
    try:
        validate_youtube_url(request.youtube_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if video ID is extractable
    video_id = extract_video_id(request.youtube_url)
    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Не удалось извлечь ID видео из URL"
        )

    # Generate task ID
    task_id = str(uuid.uuid4())

    # Create database record
    await db.create_analysis(task_id, request.youtube_url, request.player_count)

    # Start background analysis
    await task_manager.start_analysis(task_id, request.youtube_url)

    return AnalyzeResponse(
        task_id=task_id,
        status="processing",
        message="Анализ запущен. Это может занять 5-10 минут."
    )


@app.get("/api/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    """
    Get the status of an analysis task

    - **task_id**: UUID of the analysis task
    """
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
async def get_result(task_id: str):
    """
    Get the full analysis result

    - **task_id**: UUID of the analysis task
    """
    analysis = await db.get_analysis(task_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Анализ не найден")

    if analysis["status"] == "processing" or analysis["status"] == "queued":
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
    offset: int = Query(default=0, ge=0)
):
    """
    Get analysis history

    - **limit**: Maximum number of items to return (default: 20)
    - **offset**: Number of items to skip (default: 0)
    """
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
async def delete_analysis(task_id: str):
    """
    Delete an analysis record

    - **task_id**: UUID of the analysis task
    """
    # Cancel if running
    task_manager.cancel_task(task_id)

    deleted = await db.delete_analysis(task_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Анализ не найден")

    return {"message": "Анализ удалён", "task_id": task_id}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "gemini_configured": bool(GEMINI_API_KEY),
        "running_tasks": task_manager.get_running_tasks_count(),
    }


# Serve frontend static files
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

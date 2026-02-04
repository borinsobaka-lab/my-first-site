"""
Pydantic models for Padel Coach AI
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime
import re


class AnalyzeRequest(BaseModel):
    """Request model for video analysis"""
    youtube_url: str
    player_count: int = Field(default=4, ge=2, le=4)

    @field_validator('youtube_url')
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        """Validate that the URL is a valid YouTube URL"""
        youtube_patterns = [
            r'^https?://(www\.)?youtube\.com/watch\?v=[\w-]+',
            r'^https?://(www\.)?youtube\.com/live/[\w-]+',
            r'^https?://youtu\.be/[\w-]+',
        ]

        if not any(re.match(pattern, v) for pattern in youtube_patterns):
            raise ValueError('Invalid YouTube URL format')

        return v


class AnalyzeResponse(BaseModel):
    """Response model for analysis request"""
    task_id: str
    status: Literal["processing", "queued"]
    message: str = "Analysis started"


class StatusResponse(BaseModel):
    """Response model for status check"""
    task_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    progress: int = Field(ge=0, le=100)
    eta_seconds: Optional[int] = None
    error_message: Optional[str] = None


class Drill(BaseModel):
    """Training drill recommendation"""
    name: str
    duration: str
    description: str
    focus: str


class ImprovementExample(BaseModel):
    """Single example of an improvement area"""
    timestamp: str
    description: str


class Improvement(BaseModel):
    """Improvement area for a player"""
    priority: int
    issue: str
    examples: Optional[List["ImprovementExample"]] = None
    example_timestamp: Optional[str] = None  # Legacy support
    example_description: Optional[str] = None  # Legacy support
    frequency: Optional[str] = None
    how_to_fix: str
    drill: Optional[Drill] = None


class Strength(BaseModel):
    """Strength point for a player"""
    point: str
    example_timestamp: str
    example_description: str


class KeyMoment(BaseModel):
    """Key moment in the match"""
    timestamp: str
    type: Literal["positive", "negative", "neutral"]
    description: str


class PlayerScores(BaseModel):
    """Scores breakdown for a player"""
    positioning: float = Field(ge=1, le=9)
    tactics: float = Field(ge=1, le=9)
    teamwork: float = Field(ge=1, le=9)
    technique: float = Field(ge=1, le=9)


class PlayerAnalysis(BaseModel):
    """Complete analysis for a single player"""
    id: str
    description: str
    team: int
    overall_score: float
    scores: PlayerScores
    strengths: List[Strength]
    improvements: List[Improvement]
    key_moments: List[KeyMoment]
    progress_focus: str


class TeamAnalysis(BaseModel):
    """Analysis for a team"""
    team: int
    players: List[str]
    partnership_score: float
    synergy_description: str
    strength: str
    weakness: str
    recommendation: str


class Pattern(BaseModel):
    """Observed pattern in the match"""
    pattern: str
    frequency: Literal["Часто", "Иногда", "Редко"]
    affected_players: List[str]
    timestamps: List[str]
    solution: str


class MatchSummary(BaseModel):
    """Summary of the match"""
    duration_analyzed: str
    dominant_team: str
    match_character: str


class AnalysisResult(BaseModel):
    """Complete analysis result from Gemini"""
    match_summary: MatchSummary
    players: List[PlayerAnalysis]
    team_analysis: List[TeamAnalysis]
    patterns_observed: List[Pattern]


class HistoryItem(BaseModel):
    """Item in analysis history"""
    task_id: str
    youtube_url: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    match_summary: Optional[MatchSummary] = None


class HistoryResponse(BaseModel):
    """Response for history endpoint"""
    items: List[HistoryItem]
    total: int

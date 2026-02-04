"""
Gemini API integration for video analysis
"""

import os
import json
import asyncio
from typing import Optional, Dict, Any
from google import genai
from google.genai import types

from prompts.padel_analysis import PADEL_ANALYSIS_PROMPT


class GeminiService:
    """Service for interacting with Google Gemini API"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")

        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.5-flash"

    async def analyze_video(
        self,
        youtube_url: str,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Analyze a padel match video using Gemini API

        Args:
            youtube_url: Public YouTube video URL
            progress_callback: Optional callback to report progress

        Returns:
            Parsed JSON analysis result
        """
        if progress_callback:
            await progress_callback(10, "Подготовка запроса к AI...")

        # Run the synchronous Gemini call in a thread pool
        loop = asyncio.get_event_loop()

        if progress_callback:
            await progress_callback(20, "Загрузка видео в Gemini...")

        try:
            response = await loop.run_in_executor(
                None,
                self._call_gemini_sync,
                youtube_url
            )

            if progress_callback:
                await progress_callback(80, "Обработка результатов...")

            # Parse and validate the response
            result = self._parse_response(response)

            if progress_callback:
                await progress_callback(100, "Анализ завершён")

            return result

        except Exception as e:
            raise GeminiError(f"Gemini API error: {str(e)}")

    def _call_gemini_sync(self, youtube_url: str) -> Any:
        """Synchronous call to Gemini API"""
        # Normalize URL to clean format
        clean_url = normalize_youtube_url(youtube_url)

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=types.Content(
                    parts=[
                        types.Part(
                            file_data=types.FileData(
                                file_uri=clean_url
                            )
                        ),
                        types.Part(text=PADEL_ANALYSIS_PROMPT)
                    ]
                ),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                )
            )
            return response
        except Exception as e:
            error_str = str(e)
            # Provide user-friendly error messages
            if "MIME type" in error_str and "text/html" in error_str:
                raise GeminiError(
                    "Видео недоступно или приватное. Убедитесь, что видео публичное "
                    "и доступно для просмотра без авторизации."
                )
            elif "400" in error_str or "INVALID_ARGUMENT" in error_str:
                raise GeminiError(
                    "Не удалось загрузить видео. Проверьте, что ссылка корректная "
                    "и видео доступно публично."
                )
            raise

    def _parse_response(self, response: Any) -> Dict[str, Any]:
        """Parse and validate the Gemini response"""
        if not response or not response.text:
            raise GeminiError("Empty response from Gemini")

        text = response.text.strip()

        # Remove markdown code blocks if present
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError as e:
            raise GeminiError(f"Invalid JSON response: {str(e)}")

        # Basic validation
        required_fields = ["match_summary", "players", "team_analysis", "patterns_observed"]
        for field in required_fields:
            if field not in result:
                raise GeminiError(f"Missing required field: {field}")

        return result

    async def retry_with_backoff(
        self,
        youtube_url: str,
        max_retries: int = 3,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """Retry analysis with exponential backoff"""
        last_error = None

        for attempt in range(max_retries):
            try:
                return await self.analyze_video(youtube_url, progress_callback)
            except GeminiError as e:
                last_error = e
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)  # 2, 4, 8 seconds
                    if progress_callback:
                        await progress_callback(
                            -1,
                            f"Ошибка API, повтор через {wait_time}с..."
                        )
                    await asyncio.sleep(wait_time)

        raise last_error


class GeminiError(Exception):
    """Custom exception for Gemini API errors"""
    pass


def validate_youtube_url(url: str) -> bool:
    """
    Validate that the URL is a valid YouTube URL

    Returns True if valid, raises ValueError otherwise
    """
    import re

    patterns = [
        r'^https?://(www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^https?://(www\.)?youtube\.com/live/[\w-]+',
        r'^https?://youtu\.be/[\w-]+',
    ]

    if not any(re.match(pattern, url) for pattern in patterns):
        raise ValueError("Неверный формат YouTube URL")

    return True


def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL"""
    import re

    patterns = [
        r'youtube\.com/watch\?v=([\w-]+)',
        r'youtube\.com/live/([\w-]+)',
        r'youtu\.be/([\w-]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def normalize_youtube_url(url: str) -> str:
    """
    Normalize YouTube URL to the standard format expected by Gemini.
    Removes extra query parameters and converts to standard watch URL.
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Не удалось извлечь ID видео из URL")

    # Return clean URL in standard format
    return f"https://www.youtube.com/watch?v={video_id}"

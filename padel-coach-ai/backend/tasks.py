"""
Background tasks for video analysis
"""

import asyncio
from typing import Optional
from gemini_service import GeminiService, GeminiError
import database as db


class AnalysisTaskManager:
    """Manager for background analysis tasks"""

    def __init__(self):
        self.running_tasks: dict[str, asyncio.Task] = {}
        self.gemini_service: Optional[GeminiService] = None

    def initialize(self, api_key: str):
        """Initialize with Gemini API key"""
        self.gemini_service = GeminiService(api_key)

    async def start_analysis(self, task_id: str, youtube_url: str) -> None:
        """Start a background analysis task"""
        if not self.gemini_service:
            raise RuntimeError("GeminiService not initialized")

        # Create async task
        task = asyncio.create_task(
            self._run_analysis(task_id, youtube_url)
        )
        self.running_tasks[task_id] = task

        # Add cleanup callback
        task.add_done_callback(
            lambda t: self.running_tasks.pop(task_id, None)
        )

    async def _run_analysis(self, task_id: str, youtube_url: str) -> None:
        """Run the actual analysis"""
        try:
            # Update status to processing
            await db.update_analysis_status(task_id, "processing", progress=5)

            # Create progress callback
            async def progress_callback(progress: int, message: str):
                if progress >= 0:
                    await db.update_analysis_status(
                        task_id, "processing", progress=progress
                    )

            # Run analysis with retry
            result = await self.gemini_service.retry_with_backoff(
                youtube_url,
                max_retries=3,
                progress_callback=progress_callback
            )

            # Save result
            await db.update_analysis_status(
                task_id,
                "completed",
                progress=100,
                result_json=result
            )

        except GeminiError as e:
            await db.update_analysis_status(
                task_id,
                "failed",
                error_message=str(e)
            )
        except Exception as e:
            await db.update_analysis_status(
                task_id,
                "failed",
                error_message=f"Unexpected error: {str(e)}"
            )

    def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task"""
        task = self.running_tasks.get(task_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    def get_running_tasks_count(self) -> int:
        """Get count of currently running tasks"""
        return len([t for t in self.running_tasks.values() if not t.done()])


# Global task manager instance
task_manager = AnalysisTaskManager()


async def estimate_eta(progress: int) -> Optional[int]:
    """
    Estimate time remaining based on progress

    Returns estimated seconds remaining
    """
    if progress <= 0:
        return 600  # 10 minutes default

    if progress >= 100:
        return 0

    # Assume total time is about 5-10 minutes (300-600 seconds)
    # Linear estimation
    avg_total_time = 450  # 7.5 minutes average
    elapsed_fraction = progress / 100
    remaining_fraction = 1 - elapsed_fraction

    if elapsed_fraction > 0:
        return int(avg_total_time * remaining_fraction)

    return 300

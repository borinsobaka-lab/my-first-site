"""
SQLite database setup and operations for Padel Coach AI
"""

import aiosqlite
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

DATABASE_PATH = Path(__file__).parent / "padel_coach.db"


async def init_db():
    """Initialize the database with required tables"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                task_id TEXT PRIMARY KEY,
                youtube_url TEXT NOT NULL,
                player_count INTEGER DEFAULT 4,
                status TEXT DEFAULT 'queued',
                progress INTEGER DEFAULT 0,
                error_message TEXT,
                result_json TEXT,
                player_names TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_analyses_status
            ON analyses(status)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_analyses_created
            ON analyses(created_at DESC)
        """)

        # Migration: add player_names column if it doesn't exist
        try:
            await db.execute("ALTER TABLE analyses ADD COLUMN player_names TEXT")
        except:
            pass  # Column already exists

        await db.commit()


async def create_analysis(task_id: str, youtube_url: str, player_count: int = 4) -> None:
    """Create a new analysis record"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            """
            INSERT INTO analyses (task_id, youtube_url, player_count, status, progress)
            VALUES (?, ?, ?, 'queued', 0)
            """,
            (task_id, youtube_url, player_count)
        )
        await db.commit()


async def update_analysis_status(
    task_id: str,
    status: str,
    progress: int = None,
    error_message: str = None,
    result_json: dict = None
) -> None:
    """Update the status of an analysis"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        updates = ["status = ?", "updated_at = CURRENT_TIMESTAMP"]
        params = [status]

        if progress is not None:
            updates.append("progress = ?")
            params.append(progress)

        if error_message is not None:
            updates.append("error_message = ?")
            params.append(error_message)

        if result_json is not None:
            updates.append("result_json = ?")
            params.append(json.dumps(result_json, ensure_ascii=False))

        if status == 'completed' or status == 'failed':
            updates.append("completed_at = CURRENT_TIMESTAMP")

        params.append(task_id)

        query = f"UPDATE analyses SET {', '.join(updates)} WHERE task_id = ?"
        await db.execute(query, params)
        await db.commit()


async def get_analysis(task_id: str) -> Optional[Dict[str, Any]]:
    """Get analysis by task_id"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM analyses WHERE task_id = ?",
            (task_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                result = dict(row)
                if result.get('result_json'):
                    result['result_json'] = json.loads(result['result_json'])
                if result.get('player_names'):
                    result['player_names'] = json.loads(result['player_names'])
                else:
                    result['player_names'] = {}
                return result
            return None


async def get_analysis_history(limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
    """Get analysis history"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT task_id, youtube_url, status, progress, created_at, completed_at,
                   CASE
                       WHEN result_json IS NOT NULL
                       THEN json_extract(result_json, '$.match_summary')
                       ELSE NULL
                   END as match_summary
            FROM analyses
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                item = dict(row)
                if item.get('match_summary'):
                    item['match_summary'] = json.loads(item['match_summary'])
                result.append(item)
            return result


async def get_history_count() -> int:
    """Get total count of analyses"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM analyses") as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0


async def delete_analysis(task_id: str) -> bool:
    """Delete an analysis record"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM analyses WHERE task_id = ?",
            (task_id,)
        )
        await db.commit()
        return cursor.rowcount > 0


async def get_player_names(task_id: str) -> Dict[str, str]:
    """Get custom player names for an analysis"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            "SELECT player_names FROM analyses WHERE task_id = ?",
            (task_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row and row[0]:
                return json.loads(row[0])
            return {}


async def update_player_name(task_id: str, player_id: str, new_name: str) -> bool:
    """Update a single player's custom name"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Get existing names
        async with db.execute(
            "SELECT player_names FROM analyses WHERE task_id = ?",
            (task_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return False

            names = json.loads(row[0]) if row[0] else {}
            names[player_id] = new_name

            await db.execute(
                "UPDATE analyses SET player_names = ? WHERE task_id = ?",
                (json.dumps(names, ensure_ascii=False), task_id)
            )
            await db.commit()
            return True

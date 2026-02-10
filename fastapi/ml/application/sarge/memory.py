"""
SARGE Memory Manager
Provides persistent session memory using SQLite.
"""
import sqlite3
import json
import os
from typing import List, Dict, Optional
from datetime import datetime
from loguru import logger

DB_PATH = os.path.join(os.path.dirname(__file__), "sarge_memory.db")

class SargeMemory:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()
        
    def _init_db(self):
        """Initialize the chat_sessions table if it doesn't exist"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS chat_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_id ON chat_sessions(session_id)")
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to initialize memory DB: {e}")

    def get_history(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Retrieve recent chat history for a session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT role, content 
                    FROM chat_sessions 
                    WHERE session_id = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (session_id, limit))
                
                rows = cursor.fetchall()
                # Reverse to return in chronological order (oldest -> newest)
                return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]
        except Exception as e:
            logger.error(f"Failed to retrieve history for {session_id}: {e}")
            return []

    def save_turn(self, session_id: str, user_input: str, assistant_output: str):
        """Save a user-assistant exchange"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                # Save User Message
                cursor.execute("""
                    INSERT INTO chat_sessions (session_id, role, content)
                    VALUES (?, ?, ?)
                """, (session_id, "user", user_input))
                
                # Save Assistant Message
                cursor.execute("""
                    INSERT INTO chat_sessions (session_id, role, content)
                    VALUES (?, ?, ?)
                """, (session_id, "assistant", assistant_output))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to save turn for {session_id}: {e}")

    def clear_history(self, session_id: str):
        """Clear history for a session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to clear history for {session_id}: {e}")

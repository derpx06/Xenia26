"""
Crawler Cache
Simple SQLite-based cache for web crawler results.
"""
import sqlite3
import os
import json
from datetime import datetime, timedelta
from loguru import logger

DB_PATH = os.path.join(os.path.dirname(__file__), "crawler_cache.db")

class CrawlerCache:
    def __init__(self, db_path: str = DB_PATH, retention_days: int = 7):
        self.db_path = db_path
        self.retention_days = retention_days
        self._init_db()
        
    def _init_db(self):
        """Initialize cache table"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS crawl_cache (
                        url TEXT PRIMARY KEY,
                        content TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to initialize crawler cache: {e}")

    def get(self, url: str) -> str:
        """Retrieve cached content if valid"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT content, timestamp FROM crawl_cache WHERE url = ?", (url,))
                row = cursor.fetchone()
                
                if row:
                    cached_time = datetime.strptime(row["timestamp"], "%Y-%m-%d %H:%M:%S")
                    if datetime.now() - cached_time < timedelta(days=self.retention_days):
                        return row["content"]
                    else:
                        # Expired
                        self.delete(url)
            return None
        except Exception as e:
            logger.error(f"Cache retrieval failed for {url}: {e}")
            return None

    def save(self, url: str, content: str):
        """Save content to cache"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                # Upsert
                cursor.execute("""
                    INSERT OR REPLACE INTO crawl_cache (url, content, timestamp)
                    VALUES (?, ?, datetime('now', 'localtime'))
                """, (url, content))
                conn.commit()
                logger.info(f"💾 CRAWLER: Cached {url}")
        except Exception as e:
            logger.error(f"Cache save failed for {url}: {e}")
            
    def delete(self, url: str):
        """Remove a URL from cache"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM crawl_cache WHERE url = ?", (url,))
                conn.commit()
        except Exception as e:
            logger.error(f"Cache delete failed for {url}: {e}")

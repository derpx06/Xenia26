"""
Twitter/X Profile Crawler using Twikit.
Extracts profile information, top tweets, activity metrics, and topics.
"""

import json
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path
from email.utils import parsedate_to_datetime

from loguru import logger
from twikit import Client
from twikit.errors import Unauthorized,TwitterException,TooManyRequests

from ml.domain.documents import PostDocument
from .base import BaseCrawler


class TwitterProfileCrawler(BaseCrawler):
    model = PostDocument

    def __init__(
        self,
        cookies_file: str = "twitter_cookies.json",
        tweet_limit: int = 50,
        top_tweet_limit: int = 10,
    ):
        super().__init__()
        self.cookies_file = cookies_file
        self.tweet_limit = tweet_limit
        self.top_tweet_limit = top_tweet_limit
        self.client: Client | None = None

    # ------------------------------------------------------------------
    # Cookie handling (HARDENED)
    # ------------------------------------------------------------------

    def _init_client(self) -> None:
        cookies_path = Path(self.cookies_file)

        if not cookies_path.exists():
            raise RuntimeError(
                f"❌ Cookies file not found: {self.cookies_file}\n"
                f"Generate it using a Twikit login session first."
            )

        logger.info("Initializing Twitter client with cookies")
        self.client = Client(language="en-US")

        try:
            with open(cookies_path, "r", encoding="utf-8") as f:
                cookies = json.load(f)

            if not isinstance(cookies, list) or not cookies:
                raise ValueError("Cookie file is not a valid list")

            self.client.set_cookies(cookies)

        except json.JSONDecodeError:
            raise RuntimeError(
                "❌ twitter_cookies.json is empty or invalid JSON.\n"
                "Re-export cookies from a logged-in session."
            )
        except Exception as e:
            raise RuntimeError(
                f"❌ Failed to load Twitter cookies: {e}"
            )

    def _save_cookies(self) -> None:
        """Persist refreshed cookies safely."""
        if not self.client:
            return
        try:
            cookies = self.client.get_cookies()
            if cookies and isinstance(cookies, list):
                with open(self.cookies_file, "w", encoding="utf-8") as f:
                    json.dump(cookies, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save cookies: {e}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_twitter_date(value):
        if not value:
            return None

        if isinstance(value, datetime):
            return value.replace(tzinfo=timezone.utc)

        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            try:
                return parsedate_to_datetime(value).replace(tzinfo=timezone.utc)
            except Exception:
                return None

    @staticmethod
    def _format_date(dt):
        if not dt:
            return None
        if isinstance(dt, str):
            return dt
        return dt.isoformat()

    # ------------------------------------------------------------------
    # Async extractor
    # ------------------------------------------------------------------

    async def aextract(self, username: str, **kwargs) -> dict:
        logger.info(f"Scraping Twitter profile: @{username}")

        if not self.client:
            self._init_client()

        try:
            # -----------------------------
            # User
            # -----------------------------
            user = await self.client.get_user_by_screen_name(username)

            # -----------------------------
            # Tweets
            # -----------------------------
            tweets = await self.client.get_user_tweets(
                user.id,
                tweet_type="Tweets",
                count=self.tweet_limit,
            )
            tweets = list(tweets) if tweets else []

            # -----------------------------
            # Engagement sorting
            # -----------------------------
            def engagement(t):
                return (
                    (t.favorite_count or 0)
                    + (t.retweet_count or 0)
                    + (getattr(t, "reply_count", 0) or 0)
                    + (getattr(t, "quote_count", 0) or 0)
                )

            top_tweets = sorted(tweets, key=engagement, reverse=True)[
                : self.top_tweet_limit
            ]
            recent_tweets = tweets[:5]

            # -----------------------------
            # Topic extraction
            # -----------------------------
            hashtags = Counter()
            domains = Counter()

            for t in tweets:
                for h in getattr(t, "hashtags", []) or []:
                    hashtags[h.lower()] += 1
                for url in getattr(t, "urls", []) or []:
                    try:
                        domains[url.split("/")[2].replace("www.", "")] += 1
                    except Exception:
                        pass

            last_tweet_at = (
                self._parse_twitter_date(tweets[0].created_at)
                if tweets else None
            )

            now = datetime.now(timezone.utc)

            # -----------------------------
            # Final content
            # -----------------------------
            content = {
                "profile": {
                    "name": user.name,
                    "username": user.screen_name,
                    "bio": user.description or "",
                    "location": user.location or "",
                    "url": user.url or "",
                    "verified": user.verified,
                    "followers": user.followers_count or 0,
                    "following": user.following_count or 0,
                    "media_count": user.media_count or 0,
                    "profile_image_url": (
                        user.profile_image_url.replace("_normal", "")
                        if user.profile_image_url else ""
                    ),
                    "created_at": self._format_date(user.created_at),
                    "profile_url": f"https://twitter.com/{username}",
                },
                "activity": {
                    "tweet_count_checked": len(tweets),
                    "total_tweets": user.statuses_count,
                    "last_tweet_at": self._format_date(last_tweet_at),
                    "days_since_last_activity": (
                        (now - last_tweet_at).days if last_tweet_at else None
                    ),
                },
                "top_tweets": [
                    {
                        "id": str(t.id),
                        "text": t.text or "",
                        "likes": t.favorite_count or 0,
                        "retweets": t.retweet_count or 0,
                        "replies": getattr(t, "reply_count", 0) or 0,
                        "views": getattr(t, "view_count", None),
                        "created_at": self._format_date(t.created_at),
                        "url": f"https://twitter.com/{username}/status/{t.id}",
                        "is_reply": t.in_reply_to_screen_name is not None,
                    }
                    for t in top_tweets
                ],
                "recent_tweets": [
                    {
                        "id": str(t.id),
                        "text": t.text or "",
                        "created_at": self._format_date(t.created_at),
                        "url": f"https://twitter.com/{username}/status/{t.id}",
                    }
                    for t in recent_tweets
                ],
                "topics": {
                    "hashtags": hashtags.most_common(10),
                    "domains": domains.most_common(10),
                },
            }

            self._save_cookies()
            logger.info(f"✅ Finished scraping @{username}")
            return content

        except Unauthorized as e:
            logger.error("❌ Twitter authentication failed (cookies expired)")
            raise

        except TooManyRequests as e:
            logger.error("❌ Twitter rate limit reached")
            raise

        except TwitterException as e:
            logger.error(f"❌ Twitter API error: {e}")
            raise

        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            raise

    # ------------------------------------------------------------------
    # Sync wrapper
    # ------------------------------------------------------------------

    def extract(self, username: str, **kwargs):
        import asyncio
        return asyncio.run(self.aextract(username, **kwargs))


# Backward compatibility
TwitterCrawler = TwitterProfileCrawler

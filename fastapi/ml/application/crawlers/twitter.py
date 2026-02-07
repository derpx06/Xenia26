"""
Twitter/X Profile Crawler using twikit.
Extracts profile information, top tweets, activity metrics, and topics.
"""
import json
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path
from email.utils import parsedate_to_datetime

from loguru import logger
from twikit import Client
from twikit.errors import TwitterException, Unauthorized, TooManyRequests

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
        self.client = None

    def _init_client(self) -> None:
        cookies_path = Path(self.cookies_file)
        if not cookies_path.exists():
            raise FileNotFoundError(
                f"Cookies file not found: {self.cookies_file}"
            )

        logger.info("Initializing Twitter client with cookies")
        self.client = Client(language="en-US")

        with open(cookies_path, "r") as f:
            self.client.set_cookies(json.load(f))

    def _save_cookies(self) -> None:
        try:
            with open(self.cookies_file, "w") as f:
                json.dump(self.client.get_cookies(), f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save cookies: {e}")

    async def aextract(self, username: str, **kwargs) -> dict:
        """Async version of extract using twikit async methods."""
        logger.info(f"Scraping Twitter profile: @{username}")

        if not self.client:
            self._init_client()

        try:
            user = await self.client.get_user_by_screen_name(username)

            # Fetch tweets (twikit methods are async)
            tweets = await self.client.get_user_tweets(
                user.id,
                tweet_type="Tweets",
                count=self.tweet_limit,
            )
            tweets = list(tweets) if tweets else []

            # Sort for Top Tweets (Engagement)
            top_tweets = sorted(
                tweets,
                key=lambda t: (
                    (t.favorite_count or 0) + 
                    (t.retweet_count or 0) + 
                    (getattr(t, 'reply_count', 0) or 0) +
                    (getattr(t, 'quote_count', 0) or 0)
                ),
                reverse=True,
            )[: self.top_tweet_limit]
            
            # Recent Tweets
            recent_tweets = tweets[:5]

            # Analysis
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

            # Helper to parse Twitter dates
            def parse_twitter_date(date_val):
                if not date_val:
                    return None
                if isinstance(date_val, datetime):
                    return date_val.replace(tzinfo=timezone.utc)
                try:
                    # Try ISO format first
                    return datetime.fromisoformat(date_val.replace("Z", "+00:00"))
                except ValueError:
                    try:
                        # Try Twitter string format: "Fri Nov 10 12:00:00 +0000 2023"
                        return parsedate_to_datetime(date_val).replace(tzinfo=timezone.utc)
                    except Exception:
                        return None

            last_tweet_at = parse_twitter_date(tweets[0].created_at) if tweets else None
            now = datetime.now(timezone.utc)
            
            # Formatter for output dates
            def format_date(dt):
                if isinstance(dt, str): return dt
                return dt.isoformat() if dt else None

            # Enhanced Content Structure
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
                    "profile_image_url": user.profile_image_url.replace("_normal", "") if user.profile_image_url else "",
                    "created_at": format_date(user.created_at), 
                    "profile_url": f"https://twitter.com/{username}",
                },
                "activity": {
                    "tweet_count_checked": len(tweets),
                    "total_tweets": user.statuses_count,
                    "last_tweet_at": format_date(last_tweet_at),
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
                        "replies": getattr(t, 'reply_count', 0) or 0,
                        "views": getattr(t, 'view_count', None),
                        "created_at": format_date(t.created_at),
                        "url": f"https://twitter.com/{username}/status/{t.id}",
                        "is_reply": t.in_reply_to_screen_name is not None,
                    }
                    for t in top_tweets
                ],
                "recent_tweets": [
                    {
                        "id": str(t.id),
                        "text": t.text or "",
                        "created_at": format_date(t.created_at),
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
            logger.info(f"Finished scraping @{username}")
            return content

        except Unauthorized as e:
            logger.error(f"Auth error: {e}")
            raise

        except TooManyRequests as e:
            logger.error(f"Rate limited: {e}")
            raise

        except TwitterException as e:
            logger.error(f"Twitter API error: {e}")
            raise

        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise

    def extract(self, username: str, **kwargs):
        """Synchronous wrapper for aextract using asyncio.run"""
        import asyncio
        return asyncio.run(self.aextract(username, **kwargs))


# Optional backward-compat alias
TwitterCrawler = TwitterProfileCrawler

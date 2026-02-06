"""
Twitter/X Profile Crawler using twikit.
Extracts profile information, top tweets, activity metrics, and topics.
"""
import json
from typing import Dict, List, Optional
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path

from loguru import logger
from twikit import Client
from twikit.errors import TwikitException, Unauthorized, TooManyRequests

from ml.domain.documents import PostDocument
from .base import BaseCrawler


class TwitterProfileCrawler(BaseCrawler):
    """
    Robust Twitter/X profile crawler using twikit library.
    
    Features:
    - Profile information extraction
    - Top tweets by engagement
    - Activity metrics
    - Hashtag and link analysis
    - Rate limit handling
    - Cookie-based authentication
    """
    model = PostDocument
    
    def __init__(
        self,
        cookies_file: str = "twitter_cookies.json",
        tweet_limit: int = 50,
        top_tweet_limit: int = 10,
    ):
        """
        Initialize Twitter crawler.
        
        Args:
            cookies_file: Path to cookies.json file for authentication
            tweet_limit: Number of recent tweets to fetch
            top_tweet_limit: Number of top tweets to include in report
        """
        super().__init__()
        self.cookies_file = cookies_file
        self.tweet_limit = tweet_limit
        self.top_tweet_limit = top_tweet_limit
        self.client = None
    
    def _init_client(self) -> None:
        """Initialize Twitter client with cookies."""
        try:
            cookies_path = Path(self.cookies_file)
            if not cookies_path.exists():
                raise FileNotFoundError(
                    f"Cookies file not found: {self.cookies_file}\n"
                    "Please create cookies.json using your Twitter session cookies."
                )
            
            logger.info(f"Loading Twitter client from cookies: {self.cookies_file}")
            self.client = Client(language='en-US')
            
            # Load cookies
            with open(cookies_path, 'r') as f:
                cookies = json.load(f)
                self.client.set_cookies(cookies)
            
            logger.info("✅ Twitter client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Twitter client: {e}")
            raise
    
    def _save_cookies(self) -> None:
        """Save current session cookies for reuse."""
        try:
            cookies = self.client.get_cookies()
            with open(self.cookies_file, 'w') as f:
                json.dump(cookies, f, indent=2)
            logger.info(f"Cookies saved to {self.cookies_file}")
        except Exception as e:
            logger.warning(f"Could not save cookies: {e}")
    
    def extract(self, username: str, **kwargs) -> None:
        """
        Extract Twitter profile data and save to database.
        
        Args:
            username: Twitter/X username (without @)
            **kwargs: Must include 'user' key with UserDocument instance
        """
        # Check if already scraped
        profile_link = f"https://twitter.com/{username}"
        existing = self.model.find(link=profile_link)
        if existing is not None:
            logger.info(f"Twitter profile already exists: {username}")
            return
        
        logger.info(f"Starting to scrape Twitter profile: @{username}")
        
        # Initialize client
        if not self.client:
            self._init_client()
        
        try:
            # --------------------
            # 1. PROFILE
            # --------------------
            logger.info(f"Fetching profile for @{username}...")
            user = self.client.get_user_by_screen_name(username)
            logger.info(f"✅ Profile fetched: {user.name} (@{username})")
            
            # --------------------
            # 2. RECENT TWEETS
            # --------------------
            logger.info(f"Fetching {self.tweet_limit} recent tweets...")
            tweets = list(self.client.get_user_tweets(
                user.id,
                tweet_type='Tweets',
                count=self.tweet_limit
            ))
            
            if not tweets:
                logger.warning("No tweets found for this user")
                tweets = []
            else:
                logger.info(f"✅ Fetched {len(tweets)} tweets")
            
            # --------------------
            # 3. TOP TWEETS (by engagement)
            # --------------------
            top_tweets = sorted(
                tweets,
                key=lambda t: (t.favorite_count or 0, t.retweet_count or 0),
                reverse=True,
            )[:self.top_tweet_limit]
            
            logger.info(f"Selected top {len(top_tweets)} tweets by engagement")
            
            # --------------------
            # 4. ACTIVITY SIGNALS
            # --------------------
            now = datetime.now(timezone.utc)
            days_since_last_activity = None
            last_tweet_date = None
            
            if tweets:
                last_tweet_date = tweets[0].created_at
                days_since_last_activity = (now - last_tweet_date).days
            
            # --------------------
            # 5. TOPICS & LINKS
            # --------------------
            hashtags = Counter()
            domains = Counter()
            mentions = Counter()
            
            for tweet in tweets:
                # Extract hashtags
                if hasattr(tweet, 'hashtags') and tweet.hashtags:
                    for h in tweet.hashtags:
                        hashtags[h.lower()] += 1
                
                # Extract domains from URLs
                if hasattr(tweet, 'urls') and tweet.urls:
                    for url in tweet.urls:
                        try:
                            # Parse domain from URL
                            parts = url.split('/')
                            if len(parts) > 2:
                                domain = parts[2].replace('www.', '')
                                domains[domain] += 1
                        except Exception:
                            pass
                
                # Extract mentions
                if hasattr(tweet, 'user_mentions') and tweet.user_mentions:
                    for mention in tweet.user_mentions:
                        mentions[mention] += 1
            
            # --------------------
            # 6. BUILD CONTENT
            # --------------------
            content = {
                "profile": {
                    "name": user.name,
                    "username": user.screen_name,
                    "bio": user.description or "",
                    "location": user.location or "",
                    "verified": getattr(user, 'verified', False),
                    "followers": user.followers_count or 0,
                    "following": user.following_count or 0,
                    "total_tweets": user.statuses_count or 0,
                    "account_created_at": user.created_at.isoformat() if user.created_at else None,
                    "profile_url": f"https://twitter.com/{username}",
                },
                "top_tweets": [
                    {
                        "id": str(tweet.id),
                        "text": tweet.text or "",
                        "likes": tweet.favorite_count or 0,
                        "retweets": tweet.retweet_count or 0,
                        "replies": tweet.reply_count or 0,
                        "views": getattr(tweet, 'view_count', None),
                        "date": tweet.created_at.isoformat() if tweet.created_at else None,
                        "url": f"https://twitter.com/{username}/status/{tweet.id}",
                    }
                    for tweet in top_tweets
                ],
                "activity": {
                    "recent_tweets_checked": len(tweets),
                    "last_tweet_at": last_tweet_date.isoformat() if last_tweet_date else None,
                    "days_since_last_activity": days_since_last_activity,
                    "total_tweets": user.statuses_count or 0,
                },
                "impact": {
                    "followers": user.followers_count or 0,
                    "follower_following_ratio": round(
                        (user.followers_count or 0) / max(user.following_count or 1, 1),
                        2,
                    ),
                    "avg_likes_per_tweet": round(
                        sum(t.favorite_count or 0 for t in tweets) / max(len(tweets), 1),
                        2,
                    ) if tweets else 0,
                    "engagement_rate": round(
                        sum((t.favorite_count or 0) + (t.retweet_count or 0) for t in tweets) / 
                        max(len(tweets), 1) / max(user.followers_count or 1, 1) * 100,
                        2,
                    ) if tweets and user.followers_count else 0,
                },
                "topics": {
                    "top_hashtags": hashtags.most_common(10),
                    "top_mentions": mentions.most_common(10),
                    "top_link_domains": domains.most_common(10),
                },
            }
            
            # --------------------
            # 7. SAVE TO DATABASE
            # --------------------
            author = kwargs.get("user")
            if not author:
                # Create dummy user for standalone usage
                from ml.domain.documents import UserDocument
                author = UserDocument(first_name="Twitter", last_name="User")
            
            # Save as PostDocument (similar to LinkedIn)
            posts_to_save = []
            for tweet in top_tweets:
                post_doc = PostDocument(
                    platform="twitter",
                    content={
                        "text": tweet.text or "",
                        "likes": tweet.favorite_count or 0,
                        "retweets": tweet.retweet_count or 0,
                        "profile_data": content,  # Include full profile in first post
                    } if tweet == top_tweets[0] else {
                        "text": tweet.text or "",
                        "likes": tweet.favorite_count or 0,
                        "retweets": tweet.retweet_count or 0,
                    },
                    link=f"https://twitter.com/{username}/status/{tweet.id}",
                    author_id=author.id,
                    author_full_name=author.full_name,
                )
                posts_to_save.append(post_doc)
            
            if posts_to_save:
                self.model.bulk_insert(posts_to_save)
                logger.info(f"✅ Saved {len(posts_to_save)} tweets to database")
            
            # Save cookies for future use
            self._save_cookies()
            
            logger.info(f"✅ Finished scraping Twitter profile: @{username}")
            logger.info(f"   - Tweets: {len(tweets)}, Followers: {user.followers_count}")
            logger.info(f"   - Top tweets saved: {len(top_tweets)}")
            
        except Unauthorized as e:
            logger.error(f"Authentication failed: {e}")
            logger.error("Please update your cookies.json with valid Twitter session cookies")
            raise
        
        except TooManyRequests as e:
            logger.error(f"Rate limit exceeded: {e}")
            logger.error("Please wait before trying again")
            raise
        
        except TwikitException as e:
            logger.error(f"Twikit error: {e}")
            raise
        
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise


# Backward compatibility alias (if needed by dispatcher)
TwitterCrawler = TwitterProfileCrawler

#!/usr/bin/env python3
"""
Test script for Twitter Profile Crawler.
Tests profile extraction with tweet content and creates a complete report.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from loguru import logger
from ml.application.crawlers.twitter import TwitterProfileCrawler

# Configure logger
logger.add("twitter_test.log", rotation="10 MB")


def print_report(username: str):
    """Print a complete Twitter profile report."""
    from ml.domain.documents import PostDocument
    
    # Find the first post (which contains full profile data)
    posts = PostDocument.find_many(platform="twitter")
    
    if not posts:
        logger.error("No Twitter data found in database!")
        return
    
    # Find posts for this username
    user_posts = [p for p in posts if username.lower() in p.link.lower()]
    
    if not user_posts:
        logger.error(f"No data found for @{username}")
        return
    
    # Get profile data from first post
    first_post = user_posts[0]
    content = first_post.content
    profile_data = content.get('profile_data', {})
    
    if not profile_data:
        logger.warning("Profile data not found in expected location")
        return
    
    profile = profile_data.get('profile', {})
    top_tweets = profile_data.get('top_tweets', [])
    activity = profile_data.get('activity', {})
    impact = profile_data.get('impact', {})
    topics = profile_data.get('topics', {})
    
    # Display comprehensive report
    print("\n" + "=" * 80)
    print(f"TWITTER PROFILE REPORT: @{username}".center(80))
    print("=" * 80)
    
    # Profile Section
    print("\n🐦 PROFILE INFORMATION")
    print("-" * 80)
    print(f"Name:          {profile.get('name', 'N/A')}")
    print(f"Username:      @{profile.get('username', 'N/A')}")
    print(f"Verified:      {'✅ Yes' if profile.get('verified') else '❌ No'}")
    print(f"Location:      {profile.get('location') or 'N/A'}")
    print(f"Followers:     {profile.get('followers', 0):,}")
    print(f"Following:     {profile.get('following', 0):,}")
    print(f"Total Tweets:  {profile.get('total_tweets', 0):,}")
    print(f"Created:       {profile.get('account_created_at', 'N/A')}")
    
    if profile.get('bio'):
        print(f"\nBio:\n{profile['bio']}")
    
    # Impact Section
    print("\n📊 IMPACT METRICS")
    print("-" * 80)
    print(f"Followers:              {impact.get('followers', 0):,}")
    print(f"Follower/Following:     {impact.get('follower_following_ratio', 0)}")
    print(f"Avg Likes per Tweet:    {impact.get('avg_likes_per_tweet', 0)}")
    print(f"Engagement Rate:        {impact.get('engagement_rate', 0)}%")
    
    # Activity Section
    print("\n⚡ ACTIVITY")
    print("-" * 80)
    print(f"Tweets Analyzed:    {activity.get('recent_tweets_checked', 0)}")
    print(f"Last Tweet:         {activity.get('days_since_last_activity', 'N/A')} days ago")
    print(f"Total Tweets:       {activity.get('total_tweets', 0):,}")
    
    # Topics Section
    print("\n🏷️  TOPICS & HASHTAGS")
    print("-" * 80)
    hashtags = topics.get('top_hashtags', [])
    if hashtags:
        for tag, count in hashtags[:10]:
            print(f"  #{tag:<30} {count:>3} times")
    else:
        print("  No hashtags found")
    
    mentions = topics.get('top_mentions', [])
    if mentions:
        print("\n👥 TOP MENTIONS")
        print("-" * 80)
        for mention, count in mentions[:10]:
            print(f"  @{mention:<30} {count:>3} times")
    
    domains = topics.get('top_link_domains', [])
    if domains:
        print("\n🔗 TOP LINK DOMAINS")
        print("-" * 80)
        for domain, count in domains[:10]:
            print(f"  {domain:<40} {count:>3} times")
    
    # Top Tweets
    print("\n🔥 TOP TWEETS BY ENGAGEMENT")
    print("=" * 80)
    
    for i, tweet in enumerate(top_tweets, 1):
        print(f"\n{i}. Tweet ID: {tweet['id']}")
        print("-" * 80)
        print(f"Likes:      {tweet['likes']:,}")
        print(f"Retweets:   {tweet['retweets']:,}")
        print(f"Replies:    {tweet['replies']:,}")
        if tweet.get('views'):
            print(f"Views:      {tweet['views']:,}")
        print(f"Date:       {tweet['date']}")
        print(f"URL:        {tweet['url']}")
        print(f"\nText:\n{tweet['text']}")
    
    print("\n" + "=" * 80)
    print("✅ REPORT COMPLETE".center(80))
    print("=" * 80)
    print(f"\nProfile URL:    https://twitter.com/{username}")
    print(f"Data saved to:  MongoDB (posts collection)")
    print("=" * 80 + "\n")


def test_profile_extraction(username: str, cookies_file: str = "twitter_cookies.json"):
    """
    Test Twitter profile extraction and display report.
    
    Args:
        username: Twitter username (without @)
        cookies_file: Path to cookies.json file
    """
    logger.info("=" * 60)
    logger.info(f"Testing Twitter Profile Extraction: @{username}")
    logger.info("=" * 60)
    
    crawler = TwitterProfileCrawler(
        cookies_file=cookies_file,
        tweet_limit=50,
        top_tweet_limit=10
    )
    
    try:
        logger.info(f"Extracting profile data for: @{username}")
        crawler.extract(username=username)
        logger.success(f"✅ Profile extraction completed!")
        
        # Display the report
        print_report(username)
        
    except FileNotFoundError as e:
        logger.error(str(e))
        print("\n" + "=" * 80)
        print("⚠️  COOKIES FILE NOT FOUND")
        print("=" * 80)
        print("\nTo use Twitter crawler, you need a cookies.json file.")
        print("\nHow to get it:")
        print("1. Log in to Twitter/X in your browser")
        print("2. Install 'EditThisCookie' or similar extension")
        print("3. Export cookies as JSON")
        print("4. Save as 'twitter_cookies.json' in fastapi/ directory")
        print("\nOr use the twikit login method (see documentation)")
        print("=" * 80 + "\n")
    
    except Exception as e:
        logger.error(f"❌ Profile extraction failed: {e}")
        import traceback
        traceback.print_exc()
        raise


def main():
    """Main test runner."""
    print("\n" + "=" * 60)
    print("Twitter Profile Crawler Test Suite")
    print("=" * 60)
    print("\nNote: Requires twitter_cookies.json file")
    print("=" * 60)
    
    username = input("\nEnter Twitter username (without @): ").strip()
    
    if not username:
        logger.error("Username cannot be empty!")
        return
    
    cookies_file = input("Cookies file path (press Enter for default): ").strip()
    if not cookies_file:
        cookies_file = "twitter_cookies.json"
    
    test_profile_extraction(username, cookies_file)
    
    logger.success("\n✅ Test completed!")
    print("\n💡 Check 'twitter_test.log' for detailed logs")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n❌ Test suite failed: {e}")
        sys.exit(1)

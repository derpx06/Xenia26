"""
Helper to format crawler data for agent consumption.
"""
from typing import Dict, Any


def format_github_data(content: Dict[str, Any]) -> str:
    """Format GitHub profile data."""
    if not content:
        return "No data returned from GitHub crawler"
    
    profile = content.get("profile", {})
    stats = content.get("stats", {})
    repos = content.get("top_repositories", [])
    
    result = f"# GitHub Profile\n\n"
    result += f"**Name:** {profile.get('name', 'N/A')}\n"
    result += f"**Bio:** {profile.get('bio', 'N/A')}\n"
    result += f"**Location:** {profile.get('location', 'N/A')}\n"
    result += f"**Company:** {profile.get('company', 'N/A')}\n"
    result += f"**Followers:** {profile.get('followers', 0):,} | **Following:** {profile.get('following', 0):,}\n\n"
    result += f"**Stats:** ⭐ {stats.get('total_stars', 0):,} stars | 🍴 {stats.get('total_forks', 0):,} forks | 📦 {stats.get('active_repos', 0)} repos\n\n"
    
    if repos:
        result += f"## Top Repositories\n"
        for repo in repos[:5]:
            result += f"\n### {repo.get('name')}\n"
            result += f"⭐ {repo.get('stars', 0):,} | 🍴 {repo.get('forks', 0):,}\n"
            result += f"{repo.get('description', '')}\n"
            if repo.get('language'):
                result += f"**Language:** {repo.get('language')}\n"
    
    return result


def format_linkedin_data(content: Dict[str, Any]) -> str:
    """Format LinkedIn profile data."""
    if not content:
        return "No data returned from LinkedIn crawler"
    
    result = f"# LinkedIn Profile\n\n"
    result += f"**Name:** {content.get('name', 'N/A')}\n"
    result += f"**Headline:** {content.get('headline', 'N/A')}\n"
    result += f"**About:** {content.get('about', 'N/A')}\n\n"
    
    if content.get('experience'):
        result += f"## Experience\n{content.get('experience')}\n\n"
    if content.get('education'):
        result += f"## Education\n{content.get('education')}\n\n"
    
    return result


def format_article_data(content: Dict[str, Any]) -> str:
    """Format article data (Medium, custom articles)."""
    if not content:
        return "No data returned from article crawler"
    
    result = f"# {content.get('Title', 'Article')}\n\n"
    
    if content.get('Subtitle'):
        result += f"**Subtitle:** {content.get('Subtitle')}\n\n"
    
    if content.get('Content'):
        result += f"## Content\n{content.get('Content')[:1000]}...\n\n"
    
    return result


def format_twitter_data(content: Dict[str, Any]) -> str:
    """Format Twitter profile data."""
    if not content:
        return "No data returned from Twitter crawler"
    
    profile = content.get("profile", {})
    top_tweets = content.get("top_tweets", [])
    
    result = f"# Twitter Profile\n\n"
    result += f"**Name:** {profile.get('name', 'N/A')}\n"
    result += f"**Bio:** {profile.get('bio', 'N/A')}\n"
    result += f"**Followers:** {profile.get('followers', 0):,} | **Following:** {profile.get('following', 0):,}\n"
    result += f"**Tweets:** {profile.get('tweet_count', 0):,}\n\n"
    
    if top_tweets:
        result += f"## Top Tweets\n"
        for tweet in top_tweets[:3]:
            result += f"\n❤️ {tweet.get('favorite_count', 0):,} | 🔁 {tweet.get('retweet_count', 0):,}\n"
            result += f"{tweet.get('text', '')[:200]}...\n"
    
    return result

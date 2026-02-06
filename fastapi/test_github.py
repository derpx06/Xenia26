#!/usr/bin/env python3
"""
Test script for GitHub Profile Crawler.
Tests profile extraction with README content.
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from loguru import logger
from ml.application.crawlers.github import GithubProfileCrawler

# Configure logger
logger.add("github_test.log", rotation="10 MB")


def test_profile_extraction(username: str, github_token: str = None):
    """
    Test GitHub profile extraction and display complete report.
    
    Args:
        username: GitHub username (e.g., 'derpx06')
        github_token: Optional GitHub personal access token for higher rate limits
    """
    logger.info("=" * 60)
    logger.info(f"Testing GitHub Profile Extraction: {username}")
    logger.info("=" * 60)
    
    crawler = GithubProfileCrawler(
        github_token=github_token,
        top_repo_limit=5  # Fetch top 5 repos
    )
    
    try:
        logger.info(f"Extracting profile data for: {username}")
        crawler.extract(username=username)
        logger.success(f"✅ Profile extraction completed!")
        
        # Fetch the saved document to display report
        from ml.domain.documents import RepositoryDocument
        doc = RepositoryDocument.find(link=f"https://github.com/{username}")
        
        if not doc:
            logger.error("Document not found in database!")
            return
        
        content = doc.content
        
        # Display comprehensive report
        print("\n" + "=" * 80)
        print(f"GITHUB PROFILE REPORT: {username}".center(80))
        print("=" * 80)
        
        # Profile Section
        profile = content.get("profile", {})
        print("\n📋 PROFILE INFORMATION")
        print("-" * 80)
        print(f"Name:          {profile.get('name') or 'N/A'}")
        print(f"Location:      {profile.get('location') or 'N/A'}")
        print(f"Company:       {profile.get('company') or 'N/A'}")
        print(f"Blog:          {profile.get('blog') or 'N/A'}")
        print(f"Twitter:       @{profile.get('twitter_username') or 'N/A'}")
        print(f"Followers:     {profile.get('followers', 0)}")
        print(f"Following:     {profile.get('following', 0)}")
        print(f"Created:       {profile.get('account_created_at', 'N/A')}")
        
        if profile.get('bio'):
            print(f"\nBio:\n{profile['bio']}")
        
        if profile.get('profile_readme'):
            readme_preview = profile['profile_readme'][:200]
            print(f"\nProfile README (first 200 chars):\n{readme_preview}...")
        
        # Impact Section
        impact = content.get("impact", {})
        print("\n⭐ IMPACT METRICS")
        print("-" * 80)
        print(f"Total Stars:        {impact.get('total_stars', 0)}")
        print(f"Total Forks:        {impact.get('total_forks', 0)}")
        print(f"Avg Stars/Repo:     {impact.get('avg_stars_per_repo', 0)}")
        
        # Activity Section
        activity = content.get("activity", {})
        print("\n📊 ACTIVITY")
        print("-" * 80)
        print(f"Public Repos:       {activity.get('public_repos', 0)}")
        print(f"Active Repos:       {activity.get('active_repos', 0)}")
        print(f"Last Activity:      {activity.get('days_since_last_activity', 'N/A')} days ago")
        
        # Skills Section
        skills = content.get("skills", {})
        languages = skills.get("languages", {})
        topics = skills.get("top_topics", [])
        
        print("\n💻 LANGUAGES")
        print("-" * 80)
        if languages:
            # Sort by usage
            sorted_langs = sorted(languages.items(), key=lambda x: x[1], reverse=True)
            for lang, bytes_count in sorted_langs[:10]:
                kb = bytes_count / 1024
                print(f"  {lang:<20} {kb:>10.1f} KB")
        else:
            print("  No language data")
        
        print("\n🏷️  TOP TOPICS")
        print("-" * 80)
        if topics:
            for topic, count in topics[:10]:
                print(f"  {topic:<30} {count:>3} repos")
        else:
            print("  No topics")
        
        # Top Repositories
        top_repos = content.get("top_repositories", [])
        print("\n🌟 TOP REPOSITORIES")
        print("=" * 80)
        
        for i, repo in enumerate(top_repos, 1):
            print(f"\n{i}. {repo['name']}")
            print("-" * 80)
            print(f"URL:          {repo['url']}")
            print(f"Description:  {repo.get('description') or 'No description'}")
            print(f"⭐ Stars:     {repo['stars']}")
            print(f"🔱 Forks:     {repo['forks']}")
            print(f"Language:     {repo.get('language') or 'N/A'}")
            
            if repo.get('topics'):
                print(f"Topics:       {', '.join(repo['topics'][:5])}")
            
            if repo.get('readme'):
                readme_lines = repo['readme'].split('\n')[:10]
                print(f"\nREADME Preview (first 10 lines):")
                print("─" * 80)
                for line in readme_lines:
                    print(f"  {line[:76]}")
                print("─" * 80)
            else:
                print("\nNo README available")
        
        print("\n" + "=" * 80)
        print("✅ EXTRACTION COMPLETE".center(80))
        print("=" * 80)
        print(f"\nProfile URL:        https://github.com/{username}")
        print(f"Data saved to:      MongoDB (repositories collection)")
        print(f"Document ID:        {doc.id}")
        print("=" * 80 + "\n")
        
    except Exception as e:
        logger.error(f"❌ Profile extraction failed: {e}")
        import traceback
        traceback.print_exc()
        raise


def test_derpx06_profile():
    """Quick test for derpx06 profile."""
    logger.info("=" * 60)
    logger.info("Quick Test: derpx06 Profile")
    logger.info("=" * 60)
    
    test_profile_extraction("derpx06")


def main():
    """Main test runner."""
    print("\n" + "=" * 60)
    print("GitHub Profile Crawler Test Suite")
    print("=" * 60)
    print("\nAvailable Tests:")
    print("1. Test derpx06 profile (quick test)")
    print("2. Test custom username")
    print("3. Test with GitHub token (for higher rate limits)")
    print("=" * 60)
    
    choice = input("\nSelect test (1-3): ").strip()
    
    if choice == "1":
        test_derpx06_profile()
    
    elif choice == "2":
        username = input("\nEnter GitHub username: ").strip()
        if not username:
            logger.error("Username cannot be empty!")
            return
        test_profile_extraction(username)
    
    elif choice == "3":
        username = input("\nEnter GitHub username: ").strip()
        token = input("Enter GitHub token (or press Enter to skip): ").strip() or None
        if not username:
            logger.error("Username cannot be empty!")
            return
        test_profile_extraction(username, github_token=token)
    
    else:
        logger.error("Invalid choice!")
        return
    
    logger.success("\n✅ Test completed!")
    print("\n💡 Check 'github_test.log' for detailed logs")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

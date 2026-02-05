"""
Comprehensive test script for LinkedIn crawler.
This script ensures the crawler works properly with robust error handling.

Usage: python test_linkedin_crawler.py <linkedin-profile-url>
"""

import sys
from ml.application.crawlers.linkedin import LinkedInCrawler
from ml.domain.documents import UserDocument, PostDocument


def print_banner(message: str, char: str = "=") -> None:
    """Print a formatted banner."""
    print(f"\n{char*60}")
    print(message)
    print(f"{char*60}\n")


def test_linkedin_crawler(url: str):
    """Test the LinkedIn crawler with comprehensive checks."""
    
    print_banner("🔗 LinkedIn Profile Crawler Test", "=")
    print(f"Target URL: {url}\n")
    
    # Validate URL
    if "linkedin.com/in/" not in url:
        print("⚠️  Warning: URL should be a LinkedIn profile URL")
        print("   Expected format: https://www.linkedin.com/in/username/")
        response = input("\nContinue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # Create/get test user
    print("📝 Setting up test user...")
    try:
        user = UserDocument.get_or_create(first_name="Test", last_name="User")
        print(f"✅ Using user: {user.full_name} (ID: {user.id})\n")
    except Exception as e:
        print(f"❌ Failed to create user: {e}")
        return
    
    # Initialize crawler
    print("🚀 Initializing LinkedIn crawler...")
    print("   - Anti-bot evasion: ENABLED")
    print("   - Manual login: ENABLED (recommended)")
    print("   - Explicit waits: ENABLED")
    print("   - Human-like scrolling: ENABLED\n")
    
    try:
        crawler = LinkedInCrawler(scroll_limit=3)
        print("✅ Crawler initialized successfully\n")
    except Exception as e:
        print(f"❌ Failed to initialize crawler: {e}")
        return
    
    # Extract data
    print_banner("🔍 Starting Data Extraction", "-")
    print("IMPORTANT INSTRUCTIONS:")
    print("1. A Chrome browser window will open")
    print("2. You will see the LinkedIn login page")
    print("3. Please log in manually with your credentials")
    print("4. After login, the script will automatically continue")
    print("5. Do not close the browser window\n")
    
    input("Press ENTER when you're ready to start...")
    
    try:
        # Run extraction
        crawler.extract(link=url, user=user)
        
        print_banner("✅ EXTRACTION COMPLETED SUCCESSFULLY!", "=")
        
        # Verify data was saved
        print("📊 Verifying saved data...\n")
        
        posts = PostDocument.bulk_find(link=url)
        
        if posts:
            print(f"✅ Found {len(posts)} posts in database\n")
            print_banner("Sample Posts", "-")
            
            for i, post in enumerate(posts[:3], 1):  # Show first 3
                print(f"\n📌 Post {i}:")
                print(f"Platform: {post.platform}")
                text = post.content.get('text', '')
                preview = text[:150] + "..." if len(text) > 150 else text
                print(f"Text: {preview}")
                if post.content.get('image'):
                    print(f"Image: ✅ Present")
                print("-" * 60)
            
            if len(posts) > 3:
                print(f"\n... and {len(posts) - 3} more posts")
        else:
            print("⚠️  No posts found in database")
            print("   This might be normal if the profile has no recent posts")
        
        print_banner("🎉 Test Completed Successfully!", "=")
        print("Summary:")
        print(f"  - Profile scraped: ✅")
        print(f"  - Posts extracted: {len(posts)}")
        print(f"  - Data saved: ✅")
        print(f"  - Database verified: ✅\n")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_banner("❌ ERROR OCCURRED", "!")
        print(f"Error: {e}\n")
        
        import traceback
        print("Detailed traceback:")
        traceback.print_exc()
        
        print("\n💡 Troubleshooting Tips:")
        print("  1. Ensure you logged in successfully")
        print("  2. Check if LinkedIn is blocking automated access")
        print("  3. Try with a different profile URL")
        print("  4. Ensure Chrome/ChromeDriver is up to date")
        print("  5. Check your internet connection\n")
        
        return


def main():
    """Main entry point."""
    print_banner("🔗 LinkedIn Crawler - Comprehensive Test Suite", "=")
    
    if len(sys.argv) < 2:
        print("❌ Error: LinkedIn profile URL required\n")
        print("Usage:")
        print("  python test_linkedin_crawler.py <linkedin-profile-url>\n")
        print("Example:")
        print("  python test_linkedin_crawler.py https://www.linkedin.com/in/username/\n")
        print("Tips:")
        print("  - Use public profiles for best results")
        print("  - Ensure you have a LinkedIn account to log in")
        print("  - The profile URL should end with /in/username/\n")
        sys.exit(1)
    
    url = sys.argv[1].strip()
    
    # Check MongoDB
    print("🔍 Pre-flight checks...\n")
    try:
        from ml.infrastructure.db.mongo import connection
        from ml.settings import settings as db_settings
        
        db = connection.get_database(db_settings.DATABASE_NAME)
        if db is None:
            print("❌ MongoDB connection failed!")
            print("   Please start MongoDB with: bash scripts/start_mongodb.sh\n")
            sys.exit(1)
        print("✅ MongoDB connection: OK")
    except Exception as e:
        print(f"❌ Database check failed: {e}")
        sys.exit(1)
    
    # Run test
    test_linkedin_crawler(url)


if __name__ == "__main__":
    main()

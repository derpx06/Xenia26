#!/usr/bin/env python3
"""
Test script for LinkedIn Crawler.
Tests login and profile scraping functionality.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from loguru import logger
from ml.application.crawlers.linkedin import LinkedInCrawler
from ml.domain.documents import UserDocument

# Configure logger
logger.add("linkedin_test.log", rotation="10 MB")


def test_login_only():
    """Test just the login flow."""
    logger.info("=" * 60)
    logger.info("TEST 1: LinkedIn Login Flow")
    logger.info("=" * 60)
    
    crawler = LinkedInCrawler(scroll_limit=3)
    
    try:
        logger.info("Starting login test...")
        crawler.login(manual=True)
        logger.success("✅ Login test passed!")
        
        # Keep browser open for inspection
        input("Press Enter to close browser...")
        crawler.driver.quit()
        
    except Exception as e:
        logger.error(f"❌ Login test failed: {e}")
        crawler.driver.quit()
        raise


def test_profile_scraping(profile_url: str):
    """
    Test full profile scraping with login.
    
    Args:
        profile_url: Full LinkedIn profile URL (e.g., https://www.linkedin.com/in/username/)
    """
    logger.info("=" * 60)
    logger.info("TEST 2: Profile Scraping")
    logger.info("=" * 60)
    logger.info(f"Target Profile: {profile_url}")
    
    crawler = LinkedInCrawler(scroll_limit=3)
    
    try:
        # Create a test user (required by extract method)
        test_user = UserDocument(
            first_name="Test",
            last_name="User",
            email="test@example.com"
        )
        
        logger.info("Starting profile scraping test...")
        crawler.extract(link=profile_url, user=test_user)
        logger.success("✅ Profile scraping test passed!")
        
    except Exception as e:
        logger.error(f"❌ Profile scraping test failed: {e}")
        raise
    finally:
        try:
            crawler.driver.quit()
        except:
            pass


def main():
    """Main test runner."""
    print("\n" + "=" * 60)
    print("LinkedIn Crawler Test Suite")
    print("=" * 60)
    print("\nAvailable Tests:")
    print("1. Test Login Only")
    print("2. Test Profile Scraping (requires profile URL)")
    print("3. Run Both Tests")
    print("=" * 60)
    
    choice = input("\nSelect test (1-3): ").strip()
    
    if choice == "1":
        test_login_only()
    
    elif choice == "2":
        profile_url = input("\nEnter LinkedIn profile URL: ").strip()
        if not profile_url.startswith("https://www.linkedin.com"):
            logger.error("Invalid LinkedIn URL!")
            return
        test_profile_scraping(profile_url)
    
    elif choice == "3":
        test_login_only()
        print("\n" + "=" * 60)
        profile_url = input("\nEnter LinkedIn profile URL for scraping test: ").strip()
        if profile_url.startswith("https://www.linkedin.com"):
            test_profile_scraping(profile_url)
        else:
            logger.error("Invalid LinkedIn URL! Skipping profile test.")
    
    else:
        logger.error("Invalid choice!")
        return
    
    logger.success("\n✅ All tests completed!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n❌ Test suite failed: {e}")
        sys.exit(1)

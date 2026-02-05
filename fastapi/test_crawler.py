"""
Test script to try the CustomArticleCrawler on a custom website.
Usage: python test_crawler.py <url>
"""

import sys
from ml.application.crawlers.custom_article import CustomArticleCrawler
from ml.domain.documents import UserDocument
from pydantic import UUID4
import uuid


def create_test_user():
    """Create or get a test user for the crawler."""
    # Try to find existing test user using get_or_create
    user = UserDocument.get_or_create(first_name="Test", last_name="User")
    print(f"Using test user: {user.full_name} (ID: {user.id})")
    
    return user


def test_crawler(url: str):
    """Test the CustomArticleCrawler on a given URL."""
    print(f"\n{'='*60}")
    print(f"Testing CustomArticleCrawler on: {url}")
    print(f"{'='*60}\n")
    
    # Create/get test user
    user = create_test_user()
    
    # Initialize crawler
    crawler = CustomArticleCrawler()
    
    # Extract content
    try:
        crawler.extract(link=url, user=user)
        print("\n✅ Crawling completed successfully!")
        
        # Retrieve and display the extracted article
        from ml.domain.documents import ArticleDocument
        article = ArticleDocument.find(link=url)
        
        if article:
            print(f"\n{'='*60}")
            print("Extracted Article:")
            print(f"{'='*60}")
            print(f"Platform: {article.platform}")
            print(f"Author: {article.author_full_name}")
            print(f"\nContent Preview:")
            print(f"{'='*60}")
            print(f"Title: {article.content.get('Title', 'N/A')}")
            print(f"Subtitle: {article.content.get('Subtitle', 'N/A')}")
            print(f"Language: {article.content.get('language', 'N/A')}")
            print(f"\nFull Article Content:")
            print(f"{'-'*60}")
            content_text = article.content.get('Content', '')
            print(content_text)
            print(f"\n{'='*60}")
            print(f"Total content length: {len(content_text)} characters")
            print(f"{'='*60}")
        
    except Exception as e:
        print(f"\n❌ Error during crawling: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_crawler.py <url>")
        print("\nExample URLs to try:")
        print("  - https://example.com/article")
        print("  - https://techcrunch.com/2024/01/01/some-article/")
        print("  - Any article URL you want to test")
        sys.exit(1)
    
    url = sys.argv[1]
    test_crawler(url)

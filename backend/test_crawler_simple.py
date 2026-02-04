"""
Simple test script to try the crawler without database dependencies.
This just extracts and prints the content.
Usage: python test_crawler_simple.py <url>
"""

import sys
from urllib.parse import urlparse
from langchain_community.document_loaders import AsyncHtmlLoader
from langchain_community.document_transformers.html2text import Html2TextTransformer


def test_crawler_simple(url: str):
    """Test article extraction on a given URL."""
    print(f"\n{'='*60}")
    print(f"Testing Article Extraction on:")
    print(f"{url}")
    print(f"{'='*60}\n")
    
    try:
        # Load HTML content
        print("📥 Loading HTML content...")
        loader = AsyncHtmlLoader([url])
        docs = loader.load()
        
        # Transform HTML to text
        print("🔄 Converting HTML to text...")
        html2text = Html2TextTransformer()
        docs_transformed = html2text.transform_documents(docs)
        doc_transformed = docs_transformed[0]
        
        # Extract content
        content = {
            "Title": doc_transformed.metadata.get("title"),
            "Subtitle": doc_transformed.metadata.get("description"),
            "Content": doc_transformed.page_content,
            "language": doc_transformed.metadata.get("language"),
        }
        
        parsed_url = urlparse(url)
        platform = parsed_url.netloc
        
        print("\n✅ Extraction completed successfully!")
        print(f"\n{'='*60}")
        print("Extracted Article:")
        print(f"{'='*60}")
        print(f"Platform: {platform}")
        print(f"\nContent Preview:")
        print(f"{'='*60}")
        print(f"Title: {content.get('Title', 'N/A')}")
        print(f"Subtitle: {content.get('Subtitle', 'N/A')}")
        print(f"Language: {content.get('language', 'N/A')}")
        print(f"\nContent (first 1000 chars):")
        print(f"{'-'*60}")
        content_text = content.get('Content', '')
        print(content_text[:1000] + "..." if len(content_text) > 1000 else content_text)
        print(f"\n{'='*60}")
        print(f"Total content length: {len(content_text)} characters")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n❌ Error during extraction: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_crawler_simple.py <url>")
        print("\nExample URLs to try:")
        print("  - https://www.growandconvert.com/content-marketing/going-viral-medium/")
        print("  - https://techcrunch.com/2024/01/01/some-article/")
        print("  - Any article URL you want to test")
        sys.exit(1)
    
    url = sys.argv[1]
    test_crawler_simple(url)

"""
Agent tools for web search and article scraping.
"""
from typing import Annotated
from urllib.parse import urlparse
import re

from langchain_core.tools import tool
from duckduckgo_search import DDGS
from loguru import logger
from ml.application.crawlers.dispatcher import CrawlerDispatcher
from ml.application.crawlers.linkedin import LinkedInCrawler
from ml.application.crawlers.github import GithubProfileCrawler
from ml.application.crawlers.medium import MediumCrawler
from ml.application.crawlers.custom_article import CustomArticleCrawler
from ml.domain.documents import UserDocument
try:
    from ml.application.crawlers.twitter import TwitterProfileCrawler
    TWITTER_AVAILABLE = True
except ImportError:
    TWITTER_AVAILABLE = False
    logger.warning("TwitterProfileCrawler not available (twikit not installed)")


@tool
def duckduckgo_search(query: Annotated[str, "The search query to look up"]) -> str:
    """Search the web using DuckDuckGo.
    
    Use this tool when you need to find current information, news, articles, 
    or any content available on the internet.
    
    Args:
        query: The search query string
    """
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        
        if not results:
            return f"No results found for query: {query}"
        
        output = f"Search Results for '{query}':\n\n"
        for i, result in enumerate(results, 1):
            output += f"{i}. **{result['title']}**\n"
            output += f"   {result['body']}\n"
            output += f"   URL: {result['href']}\n\n"
        
        logger.info(f"duckduckgo_search returning {len(results)} results for query: '{query}'")
        return output
    except Exception as e:
        return f"Error performing search: {str(e)}"


@tool
def scrape_article(url: Annotated[str, "The URL of the article/profile to scrape"]) -> str:
    """Scrape and extract content from web articles, profiles, and repositories.
    
    Automatically detects the platform and uses the appropriate crawler:
    - Twitter/X profiles and tweets
    - LinkedIn profiles and posts
    - GitHub profiles and repositories  
    - Medium articles
    - Any other websites (generic article scraper)
    
    Args:
        url: Complete URL to scrape
    """
    from .formatters import format_github_data, format_linkedin_data, format_article_data, format_twitter_data
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().replace('www.', '')
        
        # Create dummy user for crawlers
        dummy_user = UserDocument(first_name="Agent", last_name="User")
        
        # Twitter/X
        if 'twitter.com' in domain or 'x.com' in domain:
            match = re.search(r'/([^/?]+)', parsed.path)
            if match and match.group(1) not in ['home', 'explore', 'notifications']:
                username = match.group(1)
                
                if TWITTER_AVAILABLE:
                    logger.info(f"Using TwitterProfileCrawler for @{username}")
                    try:
                        crawler = TwitterProfileCrawler(
                            cookies_file="twitter_cookies.json",
                            tweet_limit=30,
                            top_tweet_limit=5
                        )
                        content = crawler.extract(username=username, user=dummy_user)
                        if content:
                            return format_twitter_data(content)
                        return f"✅ Twitter profile @{username} scraped successfully"
                    except Exception as e:
                        logger.warning(f"Twitter scraping failed: {e}")
        
        # LinkedIn
        elif 'linkedin.com' in domain and '/in/' in parsed.path.lower():
            logger.info("Using LinkedInCrawler")
            crawler = LinkedInCrawler()
            content = crawler.extract(link=url, user=dummy_user)
            if content:
                return format_linkedin_data(content)
            return f"✅ LinkedIn profile scraped successfully"
        
        # GitHub
        elif 'github.com' in domain:
            match = re.search(r'/([^/?]+)', parsed.path)
            if match:
                username = match.group(1)
                logger.info(f"Using GithubProfileCrawler for {username}")
                crawler = GithubProfileCrawler(top_repo_limit=5)
                content = crawler.extract(username=username, user=dummy_user)
                if content:
                    return format_github_data(content)
                return f"✅ GitHub profile {username} scraped successfully"
        
        # Medium
        elif 'medium.com' in domain or 'towardsdatascience.com' in domain:
            logger.info("Using MediumCrawler")
            crawler = MediumCrawler()
            content = crawler.extract(link=url, user=dummy_user)
            if content:
                return format_article_data(content)
            return f"✅ Medium article scraped successfully"
        
        # Fallback: CustomArticleCrawler
        logger.info("Using CustomArticleCrawler")
        crawler = CustomArticleCrawler()
        content = crawler.extract(link=url, user=dummy_user)
        if content:
            return format_article_data(content)
        return f"✅ Article scraped successfully from {url}"
        
    except Exception as e:
        logger.error(f"Error scraping {url}: {e}")
        return f"❌ Error scraping {url}: {str(e)}"


@tool
def generate_email(
    recipient_name: str,
    company: str,
    purpose: str,
    tone: str = "professional",
    additional_context: str = ""
) -> str:
    """
    Generate a fully personalized email using AI.
    
    Args:
        recipient_name: Name of the email recipient
        company: Company name of the recipient  
        purpose: Purpose of the email (e.g., "introduce our AI solution", "schedule a demo")
        tone: Tone of the email - "professional", "friendly", or "casual"
        additional_context: Any additional context about the recipient or company
    
    Uses AI to create hyperpersonalized emails. Perfect for sales outreach, partnerships, or networking.
    The AI generates both subject line and body completely from scratch based on the inputs.
    """
    from langchain_ollama import ChatOllama
    
    # Create prompt for email generation
    prompt = f"""Generate a professional outreach email with the following details:

Recipient: {recipient_name}
Company: {company}
Purpose: {purpose}
Tone: {tone}
{f"Additional Context: {additional_context}" if additional_context else ""}

You must generate:
1. A compelling subject line (one line, no "Subject:" prefix)
2. A complete email body with proper greeting, personalized content, and professional closing

Format your response EXACTLY like this:
EMAIL_DRAFT_START
Subject: [your generated subject line here]
---
[your generated email body here]
EMAIL_DRAFT_END

Make the email highly personalized, relevant to the company and purpose. Keep it concise (3-4 short paragraphs).
Include a clear call-to-action. Sign off as "[Your Name]" at the end."""

    try:
        # Use Ollama to generate the email
        llm = ChatOllama(model="qwen2.5:7b", temperature=0.7)
        response = llm.invoke(prompt)
        
        logger.info(f"generate_email returning AI-generated email for {recipient_name} at {company}")
        # Return the generated content
        return response.content
        
    except Exception as e:
        # Fallback to a simple formatted message
        return f"""EMAIL_DRAFT_START
Subject: Reaching out regarding {purpose}
---
Dear {recipient_name},

I hope this email finds you well. I'm reaching out regarding {purpose}.

I believe {company} could benefit from exploring this opportunity, and I'd love to discuss how we can help you achieve your goals.

Would you be available for a brief conversation this week?

Best regards,
[Your Name]
EMAIL_DRAFT_END"""


# List of all available tools
TOOLS = [duckduckgo_search, scrape_article, generate_email]

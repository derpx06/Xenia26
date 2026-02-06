"""
Agent tools for web search and article scraping.
"""
from typing import Annotated
from langchain_core.tools import tool
from duckduckgo_search import DDGS
from langchain_community.document_loaders import AsyncHtmlLoader
from langchain_community.document_transformers import Html2TextTransformer


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
        
        return output
    except Exception as e:
        return f"Error performing search: {str(e)}"


@tool
def scrape_article(url: Annotated[str, "The URL of the article to scrape"]) -> str:
    """Scrape and extract content from a web article.
    
    Use this tool to read the full content of a specific web page or article.
    Good for extracting detailed information from URLs found in search results.
    
    Args:
        url: The complete URL of the web page to scrape
    """
    try:
        # Load the HTML content
        loader = AsyncHtmlLoader([url])
        docs = loader.load()
        
        if not docs:
            return f"Failed to load content from {url}"
        
        # Transform HTML to text
        html2text = Html2TextTransformer()
        docs_transformed = html2text.transform_documents(docs)
        
        if not docs_transformed:
            return f"Failed to extract text from {url}"
        
        doc = docs_transformed[0]
        
        # Extract metadata
        title = doc.metadata.get('title', 'No title')
        description = doc.metadata.get('description', 'No description')
        
        # Get content and truncate if too long
        content = doc.page_content
        max_content_length = 3000
        if len(content) > max_content_length:
            content = content[:max_content_length] + "... (content truncated)"
        
        # Format the result
        result = f"""
Article from: {url}

Title: {title}

Description: {description}

Content:
{content}
"""
        return result.strip()
        
    except Exception as e:
        return f"Error scraping article from {url}: {str(e)}"


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

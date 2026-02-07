from urllib.parse import urlparse

from langchain_community.document_loaders import AsyncHtmlLoader
from langchain_community.document_transformers.html2text import Html2TextTransformer
from loguru import logger

from ml.domain.documents import ArticleDocument

from .base import BaseCrawler


class CustomArticleCrawler(BaseCrawler):
    model = ArticleDocument

    def __init__(self) -> None:
        super().__init__()

    async def aextract(self, link: str, **kwargs) -> dict | None:
        old_model = await self.model.find_one({"link": link})
        if old_model is not None:
            logger.info(f"Article already exists in the database: {link}")
            return old_model.content

        logger.info(f"Starting scrapping article: {link}")
        
        try:
            import aiohttp
            
            async with aiohttp.ClientSession() as session:
                async with session.get(link, headers={"User-Agent": "Mozilla/5.0"}) as response:
                    if response.status != 200:
                        logger.error(f"Failed to fetch {link}: {response.status}")
                        return None
                    html_content = await response.text()
            
            # Run CPU-bound parsing in a separate thread
            import asyncio
            content = await asyncio.to_thread(self._parse_html, html_content, link)

            parsed_url = urlparse(link)
            platform = parsed_url.netloc

            user = kwargs.get("user")
            
            logger.info(f"Finished scrapping custom article: {link}")
            return content

        except Exception as e:
            logger.error(f"Error in CustomArticleCrawler.aextract: {e}")
            raise e

    def _parse_html(self, html_content: str, link: str) -> dict:
        """CPU-bound parsing logic to be run in a thread"""
        from bs4 import BeautifulSoup
        import html2text

        # Simple metadata extraction
        soup = BeautifulSoup(html_content, "html.parser")
        title = soup.title.string if soup.title else ""
        description = ""
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            description = meta_desc.get("content", "")
            
        # Convert to markdown
        h = html2text.HTML2Text()
        h.ignore_links = False
        content_md = h.handle(html_content)
        
        return {
            "Title": title,
            "Subtitle": description,
            "Content": content_md,
            "language": "en", # default
        }

    def extract(self, link: str, **kwargs) -> None:
        import asyncio
        return asyncio.run(self.aextract(link, **kwargs))

from urllib.parse import urlparse
from loguru import logger

from ml.domain.documents import ArticleDocument
from .base import BaseCrawler


class CustomArticleCrawler(BaseCrawler):
    model = ArticleDocument

    def __init__(self) -> None:
        super().__init__()

    async def aextract(self, link: str, **kwargs) -> dict | None:
        # Check if article exists in DB
        old_model = self.model.find(link=link)
        if old_model is not None:
            logger.info(f"Article already exists in the database: {link}")
            return old_model.content

        logger.info(f"Starting scraping article with Crawl4AI: {link}")

        try:
            from crawl4ai import AsyncWebCrawler

            async with AsyncWebCrawler() as crawler:
                # magic=True handles anti-bot detection automatically
                result = await crawler.arun(url=link, magic=True)

            if not result.success:
                logger.error(f"Failed to crawl {link}: {result.error_message}")
                return None

            content = {
                "title": result.metadata.get("title", ""),
                "subtitle": result.metadata.get("description", ""),
                "content": result.markdown,
                "language": "en", # default to en for now
                "source_url": link,
            }

            logger.info(f"Finished scraping custom article: {link}")
            return content

        except Exception as e:
            logger.error(f"Error in CustomArticleCrawler.aextract: {e}")
            raise

    def extract(self, link: str, **kwargs):
        import asyncio
        return asyncio.run(self.aextract(link, **kwargs))

import re
from urllib.parse import urlparse
from typing import Any

from loguru import logger

from .base import BaseCrawler


class CrawlerDispatcher:
    def __init__(self) -> None:
        self._crawlers = {}

    @classmethod
    def build(cls) -> "CrawlerDispatcher":
        dispatcher = cls()

        return dispatcher

    def register_medium(self) -> "CrawlerDispatcher":
        try:
            from .medium import MediumCrawler
            self.register("https://medium.com", MediumCrawler)
        except Exception as e:
            logger.warning(f"Medium crawler unavailable: {e}")

        return self

    def register_linkedin(self) -> "CrawlerDispatcher":
        try:
            from .linkedin import LinkedInCrawler
            self.register("https://linkedin.com", LinkedInCrawler)
        except Exception as e:
            logger.warning(f"LinkedIn crawler unavailable: {e}")

        return self

    def register_github(self) -> "CrawlerDispatcher":
        try:
            from .github import GithubCrawler
            self.register("https://github.com", GithubCrawler)
        except Exception as e:
            logger.warning(f"GitHub crawler unavailable: {e}")

        return self

    def register(self, domain: str, crawler: type[BaseCrawler]) -> None:
        parsed_domain = urlparse(domain)
        domain = parsed_domain.netloc

        self._crawlers[r"https://(www\.)?{}/*".format(re.escape(domain))] = crawler

    def get_crawler(self, url: str) -> BaseCrawler:
        # Check cache first
        from .cache import CrawlerCache
        cache = CrawlerCache()
        cached_content = cache.get(url)
        
        if cached_content:
            logger.info(f"🕸️ CRAWLER: Found cached content for {url}")
            # Return a dummy crawler that just returns the cached content
            from .base import BaseCrawler
            class CachedCrawler(BaseCrawler):
                def extract(self, link: str, **kwargs):
                    return cached_content
            return CachedCrawler()

        # If not cached, find the right crawler
        crawler_instance = None
        for pattern, crawler_cls in self._crawlers.items():
            if re.match(pattern, url):
                crawler_instance = crawler_cls()
                break
        
        if not crawler_instance:
            logger.warning(f"No crawler found for {url}. Defaulting to CustomArticleCrawler.")
            from .custom_article import CustomArticleCrawler
            crawler_instance = CustomArticleCrawler()
            
        # Wrap the crawler to save to cache after extraction
        original_extract = crawler_instance.extract
        
        def extract_with_cache(link: str, **kwargs):
            content = original_extract(link, **kwargs)
            if content:
                cache.save(link, content)
            return content
            
        crawler_instance.extract = extract_with_cache
        return crawler_instance

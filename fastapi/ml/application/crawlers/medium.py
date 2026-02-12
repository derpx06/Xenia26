from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseSeleniumCrawler


class MediumCrawler(BaseSeleniumCrawler):
    model = None

    def set_extra_driver_options(self, options) -> None:
        # Anti-bot detection measures
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # Realistic user agent
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
    def extract(self, link: str, **kwargs) -> None:
        import time
        logger.info(f"Starting scrapping Medium article: {link}")

        self.driver.get(link)
        
        # Handle Cloudflare Challenge: Wait and Retry
        max_retries = 3
        for i in range(max_retries):
            if "Just a moment" in self.driver.title or "Cloudflare" in self.driver.page_source:
                logger.warning(f"Cloudflare challenge detected, waiting... ({i+1}/{max_retries})")
                time.sleep(5 + (i * 2))
            else:
                break
        
        # Final wait for content load
        time.sleep(3)
        self.scroll_page()

        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        title = soup.find_all("h1", class_="pw-post-title")
        subtitle = soup.find_all("h2", class_="pw-subtitle-paragraph")
        
        content_text = soup.get_text()
        
        # Fallback for content if soup.get_text() captures the challenge text
        article_content = soup.find("article")
        if article_content:
            content_text = article_content.get_text(separator="\n")

        data = {
            "Title": title[0].string if title else self.driver.title,
            "Subtitle": subtitle[0].string if subtitle else None,
            "Content": content_text,
            "raw_html": str(soup) if "Just a moment" not in self.driver.title else None
        }

        self.driver.close()

        logger.info(f"Successfully scraped article: {link}")
        return data 

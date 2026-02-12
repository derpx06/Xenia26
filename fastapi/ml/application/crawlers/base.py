import time
from abc import ABC, abstractmethod
from tempfile import mkdtemp
from typing import Any


class BaseCrawler(ABC):
    model: Any = None

    @abstractmethod
    def extract(self, link: str, **kwargs) -> None: ...

    async def aextract(self, link: str, **kwargs) -> None:
        """Async version of extract. Default implementation delegates to extract in a thread."""
        import asyncio
        return await asyncio.to_thread(self.extract, link, **kwargs)


class BaseSeleniumCrawler(BaseCrawler, ABC):
    def __init__(self, scroll_limit: int = 5) -> None:
        from selenium import webdriver

        self._ensure_chromedriver()
        options = webdriver.ChromeOptions()

        options.add_argument("--no-sandbox")
        options.add_argument("--headless=new")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--log-level=3")
        options.add_argument("--disable-popup-blocking")
        options.add_argument("--disable-notifications")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-background-networking")
        options.add_argument("--ignore-certificate-errors")
        options.add_argument(f"--user-data-dir={mkdtemp()}")
        options.add_argument(f"--data-path={mkdtemp()}")
        options.add_argument(f"--disk-cache-dir={mkdtemp()}")
        options.add_argument("--remote-debugging-port=9226")

        self.set_extra_driver_options(options)

        self.scroll_limit = scroll_limit
        self.driver = webdriver.Chrome(
            options=options,
        )

    def set_extra_driver_options(self, options: Any) -> None:
        pass

    @staticmethod
    def _ensure_chromedriver() -> None:
        try:
            import chromedriver_autoinstaller
            chromedriver_autoinstaller.install()
        except Exception:
            pass

    def login(self) -> None:
        pass

    def scroll_page(self) -> None:
        """Scroll through the LinkedIn page based on the scroll limit."""
        current_scroll = 0
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        while True:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(5)
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height or (self.scroll_limit and current_scroll >= self.scroll_limit):
                break
            last_height = new_height
            current_scroll += 1

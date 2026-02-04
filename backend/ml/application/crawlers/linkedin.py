import time
import random
from typing import Dict, List, Optional

from bs4 import BeautifulSoup
from bs4.element import Tag
from loguru import logger
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.options import Options

from ml.domain.documents import PostDocument
from ml.domain.exceptions import ImproperlyConfigured
from ml.settings import settings

from .base import BaseSeleniumCrawler


class LinkedInCrawler(BaseSeleniumCrawler):
    """
    Modern LinkedIn crawler with anti-bot evasion and robust error handling.
    Uses manual login flow for better reliability.
    """
    model = PostDocument

    def __init__(self, scroll_limit: int = 5) -> None:
        super().__init__(scroll_limit)
        self._wait = WebDriverWait(self.driver, 20)

    def set_extra_driver_options(self, options: Options) -> None:
        """Configure Chrome options to evade bot detection."""
        # Anti-bot detection measures
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # Realistic user agent
        options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Additional options for stability
        options.add_experimental_option("detach", True)
        
        # Override navigator.webdriver via CDP
        options.add_argument('--disable-dev-shm-usage')

    def _random_delay(self, min_seconds: float = 1.0, max_seconds: float = 3.0) -> None:
        """Add random delay to mimic human behavior."""
        time.sleep(random.uniform(min_seconds, max_seconds))

    def login(self, manual: bool = True) -> None:
        """
        Login to LinkedIn. Manual login is more reliable and recommended.
        
        Args:
            manual: If True, opens login page and waits for user to login manually.
                   If False, attempts automated login (may trigger security checks).
        """
        logger.info("Navigating to LinkedIn login page...")
        self.driver.get("https://www.linkedin.com/login")
        self._random_delay(2, 4)
        
        if manual:
            logger.info("=" * 60)
            logger.info("MANUAL LOGIN REQUIRED")
            logger.info("=" * 60)
            logger.info("Please log in to LinkedIn in the browser window that opened.")
            logger.info("After logging in, the script will continue automatically.")
            logger.info("Waiting for login completion...")
            logger.info("=" * 60)
            
            # Wait for login to complete by checking for feed URL
            try:
                self._wait.until(
                    lambda driver: "feed" in driver.current_url or "in/" in driver.current_url
                )
                logger.info("✅ Login successful!")
                self._random_delay(2, 3)
            except TimeoutException:
                logger.error("Login timeout. Please ensure you logged in successfully.")
                raise Exception("Login failed or timed out")
        else:
            # Automated login (may trigger security checks)
            if not settings.LINKEDIN_USERNAME or not settings.LINKEDIN_PASSWORD:
                raise ImproperlyConfigured(
                    "Automated login requires LINKEDIN_USERNAME and LINKEDIN_PASSWORD in settings."
                )
            
            try:
                username_field = self._wait.until(
                    EC.presence_of_element_located((By.ID, "username"))
                )
                password_field = self.driver.find_element(By.ID, "password")
                
                # Type slowly like a human
                for char in settings.LINKEDIN_USERNAME:
                    username_field.send_keys(char)
                    time.sleep(random.uniform(0.05, 0.15))
                
                self._random_delay(0.5, 1)
                
                for char in settings.LINKEDIN_PASSWORD:
                    password_field.send_keys(char)
                    time.sleep(random.uniform(0.05, 0.15))
                
                self._random_delay(0.5, 1.5)
                
                login_button = self.driver.find_element(
                    By.CSS_SELECTOR, "button[type='submit']"
                )
                login_button.click()
                
                # Wait for login to complete
                self._random_delay(3, 5)
                logger.info("✅ Automated login attempted")
                
            except Exception as e:
                logger.error(f"Automated login failed: {e}")
                raise

    def extract(self, link: str, **kwargs) -> None:
        """
        Extract profile data and posts from a LinkedIn profile.
        
        Args:
            link: LinkedIn profile URL (e.g., https://www.linkedin.com/in/username/)
            **kwargs: Must include 'user' key with UserDocument instance
        """
        # Check if already scraped
        existing = self.model.find(link=link)
        if existing is not None:
            logger.info(f"Profile already exists in database: {link}")
            return

        logger.info(f"Starting to scrape profile: {link}")
        
        # Login (manual by default for better success rate)
        try:
            self.login(manual=True)
        except Exception as e:
            logger.error(f"Login failed: {e}")
            self.driver.quit()
            raise

        # Navigate to profile
        logger.info(f"Navigating to profile: {link}")
        self.driver.get(link)
        self._random_delay(3, 5)
        
        # Scroll to load dynamic content
        self._slow_scroll()
        
        # Get page content
        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        
        # Extract profile data with modern selectors
        profile_data = self._extract_profile_data(soup, link)
        
        # Extract posts
        posts = self._extract_posts_from_profile(link)
        
        logger.info(f"Extracted profile data and {len(posts)} posts")
        
        # Save to database
        user = kwargs.get("user")
        if not user:
            raise ValueError("User parameter is required")
        
        # Save posts
        if posts:
            post_documents = [
                PostDocument(
                    platform="linkedin",
                    content=post,
                    author_id=user.id,
                    author_full_name=user.full_name,
                    link=link
                )
                for post in posts
            ]
            self.model.bulk_insert(post_documents)
            logger.info(f"✅ Saved {len(posts)} posts to database")
        
        self.driver.quit()
        logger.info(f"✅ Finished scraping profile: {link}")

    def _slow_scroll(self) -> None:
        """Scroll page slowly to mimic human behavior and load dynamic content."""
        logger.info("Scrolling page to load content...")
        total_height = self.driver.execute_script("return document.body.scrollHeight")
        viewport_height = self.driver.execute_script("return window.innerHeight")
        
        current_position = 0
        while current_position < total_height:
            # Scroll by viewport height
            scroll_amount = random.randint(int(viewport_height * 0.7), int(viewport_height * 1.3))
            self.driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
            current_position += scroll_amount
            
            # Random delay
            self._random_delay(0.5, 1.5)
            
            # Update total height (may change as content loads)
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height > total_height:
                total_height = new_height

    def _extract_profile_data(self, soup: BeautifulSoup, profile_url: str) -> Dict:
        """Extract profile information using stable selectors."""
        data = {}
        
        try:
            # Name - using multiple selectors for robustness
            name_selectors = [
                ("h1", {"class": lambda c: c and "text-heading-xlarge" in str(c)}),
                ("h1", {}),
            ]
            for selector in name_selectors:
                name_elem = soup.find(*selector)
                if name_elem:
                    data["Name"] = name_elem.get_text(strip=True)
                    break
            
            # About section
            about_elem = soup.find("div", {"data-view-name": "profile-about-view"})
            if about_elem:
                data["About"] = about_elem.get_text(strip=True)
            
            # Headline
            headline_elem = soup.find("div", {"class": lambda c: c and "text-body-medium" in str(c)})
            if headline_elem:
                data["Headline"] = headline_elem.get_text(strip=True)
            
            logger.info(f"Extracted profile data: Name={data.get('Name', 'N/A')}")
            
        except Exception as e:
            logger.warning(f"Error extracting profile data: {e}")
        
        return data

    def _extract_posts_from_profile(self, profile_url: str) -> List[Dict]:
        """Extract recent posts from a LinkedIn profile."""
        posts = []
        
        try:
            # Navigate to activity/posts
            activity_url = profile_url.rstrip('/') + '/recent-activity/all/'
            logger.info(f"Navigating to activity page: {activity_url}")
            self.driver.get(activity_url)
            self._random_delay(3, 5)
            
            # Scroll to load posts
            logger.info("Loading posts with scrolling...")
            for _ in range(self.scroll_limit):
                self.driver.execute_script(
                    "window.scrollTo(0, document.body.scrollHeight);"
                )
                self._random_delay(2, 4)
            
            # Parse posts
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            
            # Find post containers - using multiple strategies
            post_containers = soup.find_all("div", {"data-view-name": "feed-shared-update-v2"})
            
            if not post_containers:
                # Fallback selector
                post_containers = soup.find_all("div", {"class": lambda c: c and "feed-shared-update-v2" in str(c)})
            
            logger.info(f"Found {len(post_containers)} post containers")
            
            for i, container in enumerate(post_containers[:20]):  # Limit to 20 posts
                try:
                    post_data = {}
                    
                    # Extract text content
                    text_elem = container.find("span", {"dir": "ltr"})
                    if not text_elem:
                        text_elem = container.find("div", {"class": lambda c: c and "update-components-text" in str(c)})
                    
                    if text_elem:
                        post_data["text"] = text_elem.get_text(strip=True, separator="\n")
                    
                    # Extract image if present
                    img_elem = container.find("img", {"class": lambda c: c and "ivm-view-attr__img--centered" in str(c) if c else False})
                    if img_elem and img_elem.get("src"):
                        post_data["image"] = img_elem["src"]
                    
                    if post_data.get("text"):
                        posts.append(post_data)
                        logger.info(f"Extracted post {i+1}: {post_data['text'][:50]}...")
                    
                except Exception as e:
                    logger.warning(f"Error extracting post {i}: {e}")
                    continue
            
            logger.info(f"✅ Successfully extracted {len(posts)} posts")
            
        except Exception as e:
            logger.error(f"Error extracting posts: {e}")
        
        return posts

    def _scrape_section(self, soup: BeautifulSoup, *args, **kwargs) -> str:
        """Scrape a specific section of the profile."""
        try:
            element = soup.find(*args, **kwargs)
            return element.get_text(strip=True) if element else ""
        except Exception as e:
            logger.warning(f"Error scraping section: {e}")
            return ""

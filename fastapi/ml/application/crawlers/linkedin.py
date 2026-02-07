"""
LinkedIn Profile Crawler using linkedin-api.
Always returns extracted content after crawling.
"""

from typing import Dict, Optional
from loguru import logger

from linkedin_api import Linkedin

from ml.domain.documents import PostDocument
from ml.domain.exceptions import ImproperlyConfigured
from ml.settings import settings
from .base import BaseCrawler


class LinkedInCrawler(BaseCrawler):
    """
    LinkedIn crawler using linkedin-api (no Selenium, no captcha).

    Requires:
    - LINKEDIN_LI_AT cookie
    - Optional LINKEDIN_JSESSIONID
    """

    model = PostDocument

    def __init__(
        self,
        li_at: Optional[str] = None,
        jsessionid: Optional[str] = None,
    ) -> None:
        super().__init__()

        self.li_at = li_at or settings.LINKEDIN_LI_AT
        self.jsessionid = jsessionid or settings.LINKEDIN_JSESSIONID

        if not self.li_at:
            raise ImproperlyConfigured(
                "Missing LINKEDIN_LI_AT cookie. "
                "LinkedInCrawler cannot run without it."
            )

        self.api = self._init_client()

    # --------------------------------------------------
    # CLIENT INIT
    # --------------------------------------------------
    def _init_client(self) -> Linkedin:
        logger.info("Initializing LinkedIn API client")

        cookies = {"li_at": self.li_at}
        if self.jsessionid:
            cookies["JSESSIONID"] = self.jsessionid

        return Linkedin(
            username=None,
            password=None,
            cookies=cookies,
        )

    # --------------------------------------------------
    # MAIN ENTRY POINT (ALWAYS RETURNS)
    # --------------------------------------------------
    def extract(self, profile_url: str, **kwargs) -> Dict:
        """
        Crawl LinkedIn profile and RETURN extracted content.
        """
        logger.info(f"Starting LinkedIn crawl: {profile_url}")

        profile_id = self._extract_profile_id(profile_url)

        try:
            raw_profile = self.api.get_profile(profile_id)
        except Exception as e:
            logger.error(f"LinkedIn API request failed: {e}")
            raise

        if not raw_profile:
            raise Exception("LinkedIn API returned empty profile")

        content = {
            "profile": self._normalize_profile(raw_profile, profile_url),
            "experience": raw_profile.get("experience", []),
            "education": raw_profile.get("education", []),
            "skills": raw_profile.get("skills", []),
            "raw": raw_profile,
        }

        logger.info(
            "✅ LinkedIn crawl completed successfully "
            f"({content['profile'].get('Name')})"
        )

        # ✅ EXPLICIT RETURN (THIS IS WHAT YOU ASKED FOR)
        return content

    # --------------------------------------------------
    # HELPERS
    # --------------------------------------------------
    def _extract_profile_id(self, url: str) -> str:
        """
        Extract profile ID from LinkedIn URL.
        """
        return url.rstrip("/").split("/")[-1]

    def _normalize_profile(self, profile: Dict, url: str) -> Dict:
        """
        Normalize LinkedIn API response.
        """
        return {
            "Name": f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip(),
            "Headline": profile.get("headline"),
            "About": profile.get("summary"),
            "Location": profile.get("locationName"),
            "Industry": profile.get("industryName"),
            "Connections": profile.get("connectionsCount"),
            "Followers": profile.get("followersCount"),
            "ProfileURL": url,
        }


# Backward compatibility
LinkedInProfileCrawler = LinkedInCrawler

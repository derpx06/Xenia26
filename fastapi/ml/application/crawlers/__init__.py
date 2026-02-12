"""
Crawler package exports.

Keep this module import-light to avoid forcing optional crawler dependencies
during unrelated app startup paths.
"""

__all__ = ["CrawlerDispatcher", "GithubCrawler", "LinkedInCrawler", "MediumCrawler"]


def __getattr__(name):
    if name == "CrawlerDispatcher":
        from .dispatcher import CrawlerDispatcher
        return CrawlerDispatcher
    if name == "GithubCrawler":
        from .github import GithubCrawler
        return GithubCrawler
    if name == "LinkedInCrawler":
        from .linkedin import LinkedInCrawler
        return LinkedInCrawler
    if name == "MediumCrawler":
        from .medium import MediumCrawler
        return MediumCrawler
    raise AttributeError(f"module {__name__} has no attribute {name}")

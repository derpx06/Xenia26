import requests
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import base64

from loguru import logger

from ml.domain.documents import RepositoryDocument
from .base import BaseCrawler


class GithubProfileCrawler(BaseCrawler):
    """
    Enhanced GitHub profile crawler that extracts:
    - Profile information (bio, location, etc.)
    - Profile README (username/username repository)
    - Top repositories with README content
    - Language statistics
    - Activity metrics
    """
    model = RepositoryDocument
    GITHUB_API = "https://api.github.com"

    def __init__(self, github_token: str | None = None, top_repo_limit: int = 5):
        super().__init__()
        self.top_repo_limit = top_repo_limit
        self.headers = {
            "Accept": "application/vnd.github+json",
        }
        if github_token:
            self.headers["Authorization"] = f"Bearer {github_token}"

    def _api(self, path: str) -> Dict[str, Any]:
        """Make GitHub API request."""
        r = requests.get(
            f"{self.GITHUB_API}{path}",
            headers=self.headers,
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    def _get_readme(self, username: str, repo_name: str) -> Optional[str]:
        """Fetch README content for a repository."""
        try:
            readme_data = self._api(f"/repos/{username}/{repo_name}/readme")
            if readme_data.get("content"):
                # Decode base64 content
                content = base64.b64decode(readme_data["content"]).decode("utf-8")
                return content
        except Exception as e:
            logger.debug(f"No README found for {repo_name}: {e}")
            return None

    def _get_profile_readme(self, username: str) -> Optional[str]:
        """
        Fetch profile README (from username/username repository).
        This is the README that appears on the profile page.
        """
        try:
            logger.info(f"Fetching profile README for {username}")
            return self._get_readme(username, username)
        except Exception as e:
            logger.debug(f"No profile README found: {e}")
            return None

    def extract(self, username: str, **kwargs) -> None:
        """
        Extract comprehensive GitHub profile data.
        
        Args:
            username: GitHub username (e.g., 'derpx06')
            **kwargs: Must include 'user' key with UserDocument instance
        """
        # Check if already scraped
        existing = self.model.find(link=f"https://github.com/{username}")
        if existing is not None:
            logger.info(f"GitHub profile already exists: {username}")
            return

        logger.info(f"Extracting GitHub profile: {username}")

        # --------------------
        # 1. USER PROFILE
        # --------------------
        user = self._api(f"/users/{username}")

        # --------------------
        # 2. PROFILE README
        # --------------------
        profile_readme = self._get_profile_readme(username)

        # --------------------
        # 3. REPOSITORIES (METADATA)
        # --------------------
        repos = self._api(f"/users/{username}/repos?per_page=100")

        language_totals = defaultdict(int)
        topic_counter = defaultdict(int)

        total_stars = 0
        total_forks = 0
        active_repos = 0
        last_push = None

        repo_summaries = []

        for repo in repos:
            if repo["fork"] or repo["archived"]:
                continue

            total_stars += repo["stargazers_count"]
            total_forks += repo["forks_count"]
            active_repos += 1

            pushed_at = repo["pushed_at"]
            if pushed_at:
                pushed_dt = datetime.fromisoformat(
                    pushed_at.replace("Z", "")
                ).replace(tzinfo=timezone.utc)
                if not last_push or pushed_dt > last_push:
                    last_push = pushed_dt

            # Topics
            for topic in repo.get("topics", []):
                topic_counter[topic] += 1

            # Languages (aggregate)
            try:
                langs = self._api(
                    f"/repos/{username}/{repo['name']}/languages"
                )
                for lang, size in langs.items():
                    language_totals[lang] += size
            except Exception:
                pass

            repo_summaries.append({
                "name": repo["name"],
                "description": repo["description"],
                "stars": repo["stargazers_count"],
                "forks": repo["forks_count"],
                "language": repo["language"],
                "topics": repo.get("topics", []),
                "pushed_at": repo["pushed_at"],
                "created_at": repo["created_at"],
                "url": repo["html_url"],
            })

        # --------------------
        # 4. TOP REPOSITORIES WITH README
        # --------------------
        top_repos = sorted(
            repo_summaries,
            key=lambda r: (
                r["stars"],
                r["forks"],
                r["pushed_at"] or ""
            ),
            reverse=True,
        )[:self.top_repo_limit]

        # Fetch README for top repos
        logger.info(f"Fetching READMEs for top {len(top_repos)} repositories...")
        for repo in top_repos:
            readme = self._get_readme(username, repo["name"])
            repo["readme"] = readme
            if readme:
                logger.info(f"✅ Fetched README for {repo['name']} ({len(readme)} chars)")

        # --------------------
        # 5. ACTIVITY SIGNALS
        # --------------------
        now = datetime.now(timezone.utc)
        days_since_last_push = (
            (now - last_push).days if last_push else None
        )

        # --------------------
        # 6. FINAL DOCUMENT
        # --------------------
        content = {
            "profile": {
                "name": user["name"],
                "bio": user["bio"],
                "profile_readme": profile_readme,  # NEW: Profile README
                "company": user["company"],
                "location": user["location"],
                "blog": user["blog"],
                "twitter_username": user.get("twitter_username"),
                "email": user.get("email"),
                "followers": user["followers"],
                "following": user["following"],
                "account_created_at": user["created_at"],
            },
            "skills": {
                "languages": dict(language_totals),
                "top_topics": sorted(
                    topic_counter.items(),
                    key=lambda x: x[1],
                    reverse=True,
                )[:10],
            },
            "top_repositories": top_repos,  # Now includes README content
            "activity": {
                "public_repos": user["public_repos"],
                "active_repos": active_repos,
                "last_push_at": last_push.isoformat() if last_push else None,
                "days_since_last_activity": days_since_last_push,
            },
            "impact": {
                "total_stars": total_stars,
                "total_forks": total_forks,
                "avg_stars_per_repo": round(total_stars / max(active_repos, 1), 2),
            },
        }

        # Get user from kwargs (required for Document)
        author = kwargs.get("user")
        if not author:
            # Create a dummy user for standalone usage
            from ml.domain.documents import UserDocument
            author = UserDocument(first_name="GitHub", last_name="User")
            # Don't save the dummy user

        instance = self.model(
            name=f"{username}_profile",  # Required by RepositoryDocument
            platform="github",
            link=user["html_url"],
            content=content,
            author_id=author.id,
            author_full_name=author.full_name,
        )
        instance.save()

        logger.info(f"✅ Finished extracting GitHub profile: {username}")
        logger.info(f"   - Repos: {active_repos}, Stars: {total_stars}, Forks: {total_forks}")
        logger.info(f"   - Profile README: {'Yes' if profile_readme else 'No'}")
        logger.info(f"   - Top repo READMEs: {sum(1 for r in top_repos if r.get('readme'))}/{len(top_repos)}")


# Backward compatibility alias
GithubCrawler = GithubProfileCrawler

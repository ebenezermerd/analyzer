"""Auto-discovery engine — finds repos without a search keyword.

Sources:
  1. GitHub Trending (weekly repos for target language)
  2. Topic-based search (web, cli, api, data, automation, etc.)
  3. Curated ecosystem (known good projects per language)
"""

from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import quote as urlquote

from bs4 import BeautifulSoup

from .async_client import AsyncGitHubClient, GITHUB
from .github_client import RepoInfo
from .profiles import ScoringProfile, PR_WRITER_PROFILE
from .config import get_curated_repos, get_discovery_topics

log = logging.getLogger(__name__)


class DiscoveryEngine:
    """Discovers repos from multiple sources without a keyword."""

    def __init__(self, client: AsyncGitHubClient, profile: ScoringProfile | None = None):
        self.client = client
        self.profile = profile or PR_WRITER_PROFILE

    async def discover(
        self,
        max_repos: int = 30,
        sources: tuple[str, ...] = ("trending", "topics", "curated"),
    ) -> list[RepoInfo]:
        """Discover repos from all enabled sources, deduplicate, and rank."""
        tasks = []
        if "trending" in sources:
            tasks.append(self._trending())
        if "topics" in sources:
            tasks.append(self._topics())
        if "curated" in sources:
            tasks.append(self._curated())

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_repos: list[RepoInfo] = []
        for r in results:
            if isinstance(r, list):
                all_repos.extend(r)
            elif isinstance(r, Exception):
                log.debug("Discovery source failed: %s", r)

        # Deduplicate by full_name
        seen: set[str] = set()
        unique: list[RepoInfo] = []
        for repo in all_repos:
            key = repo.full_name.lower()
            if key not in seen:
                seen.add(key)
                unique.append(repo)

        # Enrich repos missing size/branch info (parallel)
        enriched = await asyncio.gather(
            *[self.client.enrich_repo(r) for r in unique],
            return_exceptions=True,
        )
        repos = [r for r in enriched if isinstance(r, RepoInfo)]

        # Filter by profile criteria
        target_lang = self.profile.required_language.lower()
        js_ts_group = {"javascript", "typescript"}

        filtered = [
            r for r in repos
            if r.stars >= self.profile.min_stars
            and r.size_kb <= self.profile.max_size_mb * 1024
            and (
                not self.profile.required_language
                or r.language.lower() == target_lang
                or (r.language.lower() in js_ts_group and target_lang in js_ts_group)
            )
        ]

        # Rank: prefer higher stars, smaller size
        filtered.sort(key=lambda r: (-r.stars, r.size_kb))
        return filtered[:max_repos]

    async def _trending(self) -> list[RepoInfo]:
        """Scrape GitHub trending for repos in the target language."""
        language = self.profile.required_language
        lang_slug = language.lower()  # GitHub uses lowercase in trending URLs

        repos: list[RepoInfo] = []
        for since in ("weekly", "daily"):
            url = f"{GITHUB}/trending/{lang_slug}?since={since}"
            status, body, _ = await self.client._get(url)
            if status != 200:
                continue

            soup = BeautifulSoup(body, "lxml")
            for article in soup.select("article.Box-row, article"):
                h2 = article.select_one("h2 a, h1 a")
                if not h2 or not h2.get("href"):
                    continue
                href = h2["href"].strip("/")
                parts = href.split("/")
                if len(parts) != 2:
                    continue
                full_name = f"{parts[0]}/{parts[1]}"

                # Try to extract stars from the page
                stars = 0
                star_link = article.select_one('a[href$="/stargazers"]')
                if star_link:
                    star_text = star_link.get_text(strip=True).replace(",", "")
                    try:
                        stars = int(star_text)
                    except ValueError:
                        pass

                desc_el = article.select_one("p")
                desc = desc_el.get_text(strip=True) if desc_el else ""

                # Extract language
                lang = ""
                lang_span = article.select_one('[itemprop="programmingLanguage"]')
                if lang_span:
                    lang = lang_span.get_text(strip=True)

                repos.append(RepoInfo(
                    full_name=full_name,
                    stars=stars,
                    size_kb=0,
                    language=lang or language,
                    default_branch="",
                    html_url=f"{GITHUB}/{full_name}",
                    description=desc,
                    pushed_at=None,
                ))

            if len(repos) >= 25:
                break

        return repos

    async def _topics(self) -> list[RepoInfo]:
        """Search repos by popular topics for the target language."""
        language = self.profile.required_language
        topics = get_discovery_topics(language)
        all_repos: list[RepoInfo] = []

        async def _search_topic(topic: str) -> list[RepoInfo]:
            return await self.client.search_repos(
                query=f"topic:{topic}",
                language=language,
                min_stars=self.profile.min_stars,
                max_results=10,
            )

        tasks = [_search_topic(t) for t in topics]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if isinstance(r, list):
                all_repos.extend(r)

        return all_repos

    async def _curated(self) -> list[RepoInfo]:
        """Fetch info for curated repos in the target language."""
        language = self.profile.required_language
        curated = get_curated_repos(language)
        if not curated:
            return []
        tasks = [self.client.get_repo_info(name) for name in curated]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, RepoInfo)]

"""Service layer wrapping the issue_finder package for the web API."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from dataclasses import asdict
from typing import AsyncGenerator

# Add the issue_finder package to path
sys.path.insert(0, "/Users/tsin/Developer/analyzer/.venv/lib/python3.12/site-packages")

from issue_finder.async_client import AsyncGitHubClient
from issue_finder.cache import CacheStore
from issue_finder.discovery import DiscoveryEngine
from issue_finder.github_client import RepoInfo, IssueInfo
from issue_finder.issue_analyzer import (
    IssueAnalysisResult, pre_filter, _body_is_pure_and_substantial,
    _count_code_files, compute_passes,
)
from issue_finder.profiles import (
    ScoringProfile, PR_WRITER_PROFILE, GENERAL_PROFILE,
    load_profile, list_profiles, BUILTIN_PROFILES,
)

log = logging.getLogger(__name__)


class GitHubService:
    """Wraps issue_finder for the web API with streaming support."""

    def __init__(self, token: str | None = None, language: str = "Python"):
        self.token = token
        self.language = language
        self.cache = CacheStore(enabled=True)
        self.client = AsyncGitHubClient(
            token=token,
            cache=self.cache,
            concurrency=10 if token else 2,
        )
        self.profile = PR_WRITER_PROFILE

    async def close(self):
        await self.client.close()

    def set_profile(self, name: str):
        self.profile = load_profile(name)

    # ── Discovery ────────────────────────────────────────────────

    async def discover(
        self,
        sources: tuple[str, ...] = ("trending", "topics", "curated"),
        max_repos: int = 30,
    ) -> list[dict]:
        engine = DiscoveryEngine(self.client, self.profile)
        repos = await engine.discover(max_repos=max_repos, sources=sources)
        return [self._repo_to_dict(r) for r in repos]

    async def discover_stream(
        self,
        sources: tuple[str, ...] = ("trending", "topics", "curated"),
        max_repos: int = 30,
    ) -> AsyncGenerator[dict, None]:
        """Stream discovery progress events."""
        yield {"type": "status", "message": f"Discovering repos from: {', '.join(sources)}..."}

        engine = DiscoveryEngine(self.client, self.profile)
        repos = await engine.discover(max_repos=max_repos, sources=sources)

        for i, r in enumerate(repos):
            yield {
                "type": "repo",
                "index": i,
                "total": len(repos),
                "data": self._repo_to_dict(r),
            }

        yield {"type": "done", "total": len(repos)}

    # ── Search ───────────────────────────────────────────────────

    async def search_repos(
        self,
        query: str,
        min_stars: int = 200,
        max_results: int = 50,
    ) -> list[dict]:
        repos = await self.client.search_repos(
            query=query,
            language=self.language,
            min_stars=min_stars,
            max_results=max_results,
        )
        return [self._repo_to_dict(r) for r in repos]

    # ── Repo Info ────────────────────────────────────────────────

    async def get_repo(self, full_name: str) -> dict | None:
        info = await self.client.get_repo_info(full_name)
        return self._repo_to_dict(info) if info else None

    # ── Issues ───────────────────────────────────────────────────

    async def get_issues(
        self,
        repo: str,
        max_issues: int = 100,
        smart_filter: bool = True,
    ) -> dict:
        """Fetch, enrich, filter, and rank issues for a repo."""
        issues = await self.client.list_closed_issues(repo, max_issues=max_issues)

        # Enrich in parallel
        enrichment = {}
        tasks = [self._enrich_issue(repo, iss, enrichment) for iss in issues]
        await asyncio.gather(*tasks, return_exceptions=True)

        total = len(issues)

        # Filter
        if smart_filter:
            filtered = []
            for iss in issues:
                m = enrichment.get(iss.number, {})
                if m.get("has_pr") is False:
                    continue
                if m.get("pre_filter") is False:
                    continue
                if self.profile.require_pure_body and m.get("body_pure") is False:
                    continue
                filtered.append(iss)
            issues = filtered

        # Sort by relevance
        preferred = {l.lower() for l in self.profile.preferred_labels}
        min_files = self.profile.min_code_files_changed

        def relevance(iss):
            m = enrichment.get(iss.number, {})
            s = 0.0
            if m.get("has_pr"): s += 3.0
            if m.get("body_pure"): s += 2.0
            py = m.get("py_files")
            if py is not None and py >= min_files: s += 3.0
            elif py is not None: s += py * 0.5
            if any(l.lower() in preferred for l in iss.labels): s += 1.0
            return s

        issues.sort(key=lambda i: -relevance(i))

        return {
            "total": total,
            "filtered": len(issues),
            "issues": [
                {
                    **self._issue_to_dict(iss),
                    "metrics": enrichment.get(iss.number, {}),
                    "relevance": relevance(iss),
                }
                for iss in issues
            ],
        }

    async def get_issues_stream(
        self,
        repo: str,
        max_issues: int = 100,
    ) -> AsyncGenerator[dict, None]:
        """Stream issue fetching + enrichment progress."""
        yield {"type": "status", "message": "Fetching closed issues..."}

        issues = await self.client.list_closed_issues(repo, max_issues=max_issues)
        yield {"type": "status", "message": f"Found {len(issues)} issues, enriching..."}

        enrichment = {}
        done = 0
        for iss in issues:
            await self._enrich_issue(repo, iss, enrichment)
            done += 1
            if done % 5 == 0:
                yield {"type": "progress", "done": done, "total": len(issues)}

        yield {"type": "status", "message": "Filtering and ranking..."}

        # Filter + sort (same logic as get_issues)
        preferred = {l.lower() for l in self.profile.preferred_labels}
        min_files = self.profile.min_code_files_changed
        total = len(issues)

        filtered = []
        for iss in issues:
            m = enrichment.get(iss.number, {})
            if m.get("has_pr") is False: continue
            if m.get("pre_filter") is False: continue
            if self.profile.require_pure_body and m.get("body_pure") is False: continue
            filtered.append(iss)

        def relevance(iss):
            m = enrichment.get(iss.number, {})
            s = 0.0
            if m.get("has_pr"): s += 3.0
            if m.get("body_pure"): s += 2.0
            py = m.get("py_files")
            if py is not None and py >= min_files: s += 3.0
            elif py is not None: s += py * 0.5
            if any(l.lower() in preferred for l in iss.labels): s += 1.0
            return s

        filtered.sort(key=lambda i: -relevance(i))

        yield {
            "type": "done",
            "total": total,
            "filtered": len(filtered),
            "issues": [
                {
                    **self._issue_to_dict(iss),
                    "metrics": enrichment.get(iss.number, {}),
                    "relevance": relevance(iss),
                }
                for iss in filtered
            ],
        }

    # ── Analysis ─────────────────────────────────────────────────

    async def analyze_issue(self, repo: str, issue_number: int) -> dict:
        """Full analysis of a single issue."""
        issue = await self.client.get_issue_detail_api(repo, issue_number)
        if not issue:
            issue = await self.client.get_issue_detail(repo, issue_number)
        if not issue:
            return {"error": f"Issue #{issue_number} not found"}

        result = await self.client.analyze_issue(repo, issue, self.profile)
        return self._analysis_to_dict(result)

    # ── Scan ─────────────────────────────────────────────────────

    async def scan_repo(self, repo: str, max_issues: int = 100) -> list[dict]:
        results = await self.client.scan_repo(
            repo, self.profile,
            max_issues=max_issues,
            pre_filter=lambda i, p: pre_filter(i, p),
        )
        return [self._analysis_to_dict(r) for r in results]

    async def scan_repo_stream(
        self,
        repo: str,
        max_issues: int = 100,
    ) -> AsyncGenerator[dict, None]:
        yield {"type": "status", "message": f"Scanning {repo}..."}

        results = await self.client.scan_repo(
            repo, self.profile,
            max_issues=max_issues,
            pre_filter=lambda i, p: pre_filter(i, p),
        )

        for i, r in enumerate(results):
            yield {
                "type": "result",
                "index": i,
                "total": len(results),
                "data": self._analysis_to_dict(r),
            }

        yield {"type": "done", "total": len(results)}

    async def autoscan_stream(
        self,
        max_repos: int = 10,
    ) -> AsyncGenerator[dict, None]:
        """Full pipeline: discover → scan → stream results."""
        yield {"type": "phase", "phase": "discover", "message": "Discovering repos..."}

        engine = DiscoveryEngine(self.client, self.profile)
        repos = await engine.discover(max_repos=max_repos)
        yield {"type": "phase", "phase": "discover_done", "repos": len(repos)}

        yield {"type": "phase", "phase": "scan", "message": f"Scanning {len(repos)} repos..."}

        all_results = []
        for i, repo in enumerate(repos):
            try:
                enriched = await self.client.enrich_repo(repo)
                if enriched.size_kb > self.profile.max_size_mb * 1024:
                    continue
                if enriched.stars < self.profile.min_stars:
                    continue

                results = await self.client.scan_repo(
                    enriched.full_name, self.profile,
                    max_issues=50,
                    pre_filter=lambda iss, p: pre_filter(iss, p),
                )
                hits = len(results)
                all_results.extend(results)

                yield {
                    "type": "repo_done",
                    "index": i + 1,
                    "total": len(repos),
                    "repo": enriched.full_name,
                    "hits": hits,
                }
            except Exception as e:
                yield {
                    "type": "repo_done",
                    "index": i + 1,
                    "total": len(repos),
                    "repo": repo.full_name,
                    "hits": 0,
                    "error": str(e),
                }

        all_results.sort(key=lambda r: r.score, reverse=True)

        yield {
            "type": "done",
            "total_results": len(all_results),
            "results": [self._analysis_to_dict(r) for r in all_results],
        }

    # ── Profiles ─────────────────────────────────────────────────

    # ── PR Diff ──────────────────────────────────────────────

    async def get_pr_diff(self, repo: str, pr_number: int) -> list[dict]:
        """Fetch file-level diffs for a PR."""
        pr = await self.client.get_pr_detail(repo, pr_number)
        if not pr:
            return []
        return [
            {
                "filename": f.filename,
                "additions": f.additions,
                "deletions": f.deletions,
                "changes": f.changes,
                "patch": f.patch or "",
            }
            for f in pr.files
        ]

    @staticmethod
    def get_profiles() -> list[dict]:
        return [
            {"name": p.name, "description": p.description, "min_stars": p.min_stars,
             "min_score": p.min_score, "language": p.required_language}
            for p in list_profiles()
        ]

    # ── Helpers ──────────────────────────────────────────────────

    async def _enrich_issue(self, repo: str, iss: IssueInfo, out: dict):
        m = {"has_pr": None, "pr_count": 0, "py_files": None, "body_pure": None, "pre_filter": True}
        try:
            pr_nums = await self.client.get_linked_prs(repo, iss.number)
            m["pr_count"] = len(pr_nums)

            closing_pr = None
            if pr_nums:
                for pn in pr_nums:
                    pr = await self.client.get_pr_detail(repo, pn)
                    if pr and iss.number in pr.closes_issues:
                        closing_pr = pr
                        break
                if not closing_pr and pr_nums:
                    pr = await self.client.get_pr_detail(repo, pr_nums[0])
                else:
                    pr = closing_pr

            m["has_pr"] = closing_pr is not None
            if pr_nums and not closing_pr:
                m["has_pr"] = None

            if pr_nums and pr and pr.files:
                m["py_files"] = _count_code_files(pr.files, self.language)

            if iss.body is None:
                detail = await self.client.get_issue_detail_api(repo, iss.number)
                if detail:
                    iss.body = detail.body

            m["body_pure"] = _body_is_pure_and_substantial(iss.body)
            m["pre_filter"] = pre_filter(iss, self.profile)
        except Exception:
            pass

        out[iss.number] = m

    @staticmethod
    def _repo_to_dict(r: RepoInfo) -> dict:
        return {
            "full_name": r.full_name,
            "stars": r.stars,
            "size_mb": round(r.size_kb / 1024, 1),
            "language": r.language,
            "default_branch": r.default_branch,
            "html_url": r.html_url,
            "description": r.description,
            "pushed_at": r.pushed_at,
        }

    @staticmethod
    def _issue_to_dict(i: IssueInfo) -> dict:
        return {
            "number": i.number,
            "title": i.title,
            "body": (i.body or "")[:500],
            "state": i.state,
            "html_url": i.html_url,
            "created_at": i.created_at,
            "closed_at": i.closed_at,
            "user_login": i.user_login,
            "comments_count": i.comments_count,
            "labels": i.labels,
        }

    @staticmethod
    def _analysis_to_dict(r: IssueAnalysisResult) -> dict:
        pr = r.pr_analysis
        return {
            "issue": {
                "number": r.issue.number,
                "title": r.issue.title,
                "body": (r.issue.body or "")[:500],
                "html_url": r.issue.html_url,
                "labels": r.issue.labels,
                "created_at": r.issue.created_at,
                "closed_at": r.issue.closed_at,
            },
            "passes": r.passes,
            "score": r.score,
            "reasons": r.reasons,
            "complexity_hint": r.complexity_hint,
            "details": r.details,
            "pr": {
                "number": pr.number,
                "html_url": pr.html_url,
                "state": pr.state,
                "merged": pr.merged,
                "closes_issues": pr.closes_issues,
                "base_sha": pr.base_sha,
                "files_count": len(pr.files),
                "total_additions": sum(f.additions for f in pr.files),
                "total_deletions": sum(f.deletions for f in pr.files),
            } if pr else None,
        }

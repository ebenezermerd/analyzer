"""Async GitHub client — parallel repo/issue/PR analysis via aiohttp.

Replaces the sequential scraper and PyGithub client with fully concurrent
operations while reusing the same data structures and HTML parsers.
"""

from __future__ import annotations

import asyncio
import logging
import random
import re
from dataclasses import asdict
from urllib.parse import quote as urlquote

import aiohttp
from bs4 import BeautifulSoup

from .cache import CacheStore
from .github_client import IssueInfo, PRAnalysis, PRFileChange, RepoInfo
from .profiles import ScoringProfile, PR_WRITER_PROFILE
from .issue_analyzer import (
    IssueAnalysisResult,
    _body_has_links_or_images,
    _body_is_pure_and_substantial,
    _count_code_files,
    _count_code_python_files,
    _has_substantial_changes,
    compute_passes,
)
from .scraper import GitHubScraper  # reuse HTML parsers

log = logging.getLogger(__name__)

GITHUB = "https://github.com"
API = "https://api.github.com"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"

_PR_NUM = re.compile(r"/pull/(\d+)")
_CLOSES_KW = re.compile(
    r"(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)"
    r"\s+(?:[\w.-]+/[\w.-]+)?#(\d+)",
    re.IGNORECASE,
)


class AsyncGitHubClient:
    """Fully async GitHub client with caching and concurrency control."""

    def __init__(
        self,
        token: str | None = None,
        cache: CacheStore | None = None,
        concurrency: int | None = None,
        scrape_concurrency: int | None = None,
        request_timeout: int = 20,
        retry_attempts: int = 3,
        retry_base_delay_ms: int = 300,
        retry_max_delay_ms: int = 5000,
        retry_jitter: bool = True,
        token_throttle_sec: float = 0.15,
        no_token_throttle_sec: float = 1.0,
        no_token_concurrency: int = 2,
    ):
        self.token = token
        self.cache = cache or CacheStore(enabled=False)
        self.request_timeout = request_timeout
        self.retry_attempts = max(1, retry_attempts)
        self.retry_base_delay_ms = max(0, retry_base_delay_ms)
        self.retry_max_delay_ms = max(self.retry_base_delay_ms, retry_max_delay_ms)
        self.retry_jitter = retry_jitter
        # Auto-tune concurrency: with token we can be faster, without we must be gentle
        if token:
            api_c = concurrency or 10
            scrape_c = scrape_concurrency or 5
        else:
            api_c = concurrency or no_token_concurrency
            scrape_c = scrape_concurrency or no_token_concurrency
        self._api_concurrency = api_c
        self._api_sem = asyncio.Semaphore(api_c)
        self._scrape_sem = asyncio.Semaphore(scrape_c)
        self._rate_limit_count = 0
        self._session: aiohttp.ClientSession | None = None
        # Reuse sync scraper's HTML parsers
        self._scraper = GitHubScraper(token)

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            headers = {"User-Agent": UA}
            if self.token:
                headers["Authorization"] = f"token {self.token}"
            self._session = aiohttp.ClientSession(headers=headers)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _get(
        self,
        url: str,
        *,
        accept: str = "text/html",
        is_api: bool = False,
        timeout: int | None = None,
    ) -> tuple[int, str, dict]:
        """GET with rate limiting, retries, and semaphore control."""
        sem = self._api_sem if is_api else self._scrape_sem
        session = await self._ensure_session()
        timeout = timeout or self.request_timeout

        async with sem:
            headers = {"Accept": accept}
            for attempt in range(self.retry_attempts):
                try:
                    async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                        body = await resp.text()
                        if resp.status == 429 or (resp.status == 403 and "rate limit" in body.lower()):
                            self._rate_limit_count += 1
                            retry_after = resp.headers.get("Retry-After")
                            try:
                                wait = int(retry_after) if retry_after else 5
                            except (ValueError, TypeError):
                                wait = 5
                            # Adaptive backoff: increase wait as rate limits accumulate
                            wait = max(wait, min(self._rate_limit_count, 30))
                            wait = min(wait, 120)
                            log.warning("Rate limited on %s, waiting %ds (hit #%d)", url.split("?")[0].split("/")[-1], wait, self._rate_limit_count)
                            await asyncio.sleep(wait)
                            continue
                        return resp.status, body, dict(resp.headers)
                except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                    if attempt == self.retry_attempts - 1:
                        log.warning("Request failed after retries: %s", exc)
                        return 0, "", {}
                    delay = min(self.retry_max_delay_ms, self.retry_base_delay_ms * (2 ** attempt)) / 1000.0
                    if self.retry_jitter and delay > 0:
                        delay *= random.uniform(0.8, 1.2)
                    await asyncio.sleep(delay)

        return 0, "", {}

    async def _get_json(self, url: str, **kwargs) -> dict | list | None:
        status, body, _ = await self._get(url, accept="application/vnd.github.v3+json", is_api=True, **kwargs)
        if status != 200:
            return None
        try:
            import json
            return json.loads(body)
        except Exception:
            return None

    # ── Repo Operations ──────────────────────────────────────────

    async def search_repos(
        self,
        query: str,
        language: str = "Python",
        min_stars: int = 200,
        max_results: int = 50,
    ) -> list[RepoInfo]:
        """Search repos via GitHub REST API (no HTML scraping)."""
        cache_key = f"{query}:{language}:{min_stars}:{max_results}"
        cached = await self.cache.get("repos", cache_key)
        if cached:
            return [RepoInfo(**r) for r in cached]

        results: list[RepoInfo] = []
        page = 1
        per_page = min(max_results, 30)  # Search API max is 30 per page

        while len(results) < max_results:
            q = f"{query} language:{language} stars:>={min_stars}"
            url = f"{API}/search/repositories?q={urlquote(q)}&sort=stars&order=desc&per_page={per_page}&page={page}"
            data = await self._get_json(url)

            if not data or not isinstance(data, dict):
                break

            items = data.get("items", [])
            if not items:
                break

            for item in items:
                if len(results) >= max_results:
                    break
                full_name = item.get("full_name", "")
                if not full_name:
                    continue
                results.append(RepoInfo(
                    full_name=full_name,
                    stars=item.get("stargazers_count", 0),
                    size_kb=item.get("size", 0),
                    language=item.get("language") or "",
                    default_branch=item.get("default_branch") or "main",
                    html_url=item.get("html_url", f"{GITHUB}/{full_name}"),
                    description=item.get("description"),
                    pushed_at=item.get("pushed_at"),
                ))
            page += 1
            if len(items) < per_page:
                break

        if results:
            await self.cache.set("repos", cache_key, [self._repo_dict(r) for r in results], self.cache.ttl_search)
        return results

    async def get_repo_info(self, full_name: str) -> RepoInfo | None:
        cached = await self.cache.get("repo_info", full_name)
        if cached:
            return RepoInfo(**cached)

        data = await self._get_json(f"{API}/repos/{full_name}")
        if not data or not isinstance(data, dict):
            return None

        info = RepoInfo(
            full_name=data.get("full_name", full_name),
            stars=data.get("stargazers_count", 0),
            size_kb=data.get("size", 0),
            language=data.get("language") or "",
            default_branch=data.get("default_branch") or "main",
            html_url=data.get("html_url", f"{GITHUB}/{full_name}"),
            description=data.get("description"),
            pushed_at=data.get("pushed_at"),
        )
        await self.cache.set("repo_info", full_name, self._repo_dict(info), self.cache.ttl_repo)
        return info

    async def enrich_repo(self, repo: RepoInfo) -> RepoInfo:
        if repo.size_kb and repo.default_branch:
            return repo
        enriched = await self.get_repo_info(repo.full_name)
        return enriched or repo

    # ── Issue Operations ─────────────────────────────────────────

    async def list_closed_issues(
        self, repo: str, max_pages: int = 3, max_issues: int = 50,
    ) -> list[IssueInfo]:
        """List closed issues via REST API (no HTML scraping)."""
        cache_key = f"{repo}:{max_issues}"
        cached = await self.cache.get("issues", cache_key)
        if cached:
            return [IssueInfo(**i) for i in cached]

        issues: list[IssueInfo] = []
        seen: set[int] = set()
        per_page = min(max_issues, 100)

        for page in range(1, max_pages + 1):
            if len(issues) >= max_issues:
                break
            url = f"{API}/repos/{repo}/issues?state=closed&per_page={per_page}&page={page}"
            data = await self._get_json(url)
            if not data or not isinstance(data, list):
                break
            if not data:
                break
            for item in data:
                if len(issues) >= max_issues:
                    break
                # Skip pull requests (they have a pull_request key)
                if "pull_request" in item:
                    continue
                num = item.get("number")
                if not num or num in seen:
                    continue
                seen.add(num)
                issues.append(IssueInfo(
                    number=num,
                    title=item.get("title", f"Issue #{num}"),
                    body=item.get("body") or None,
                    state=item.get("state", "closed"),
                    html_url=item.get("html_url", f"{GITHUB}/{repo}/issues/{num}"),
                    created_at=item.get("created_at", ""),
                    closed_at=item.get("closed_at"),
                    user_login=item.get("user", {}).get("login", ""),
                    comments_count=item.get("comments", 0),
                    labels=[l.get("name", "") for l in item.get("labels", [])],
                ))
            if len(data) < per_page:
                break

        if issues:
            await self.cache.set("issues", cache_key, [self._issue_dict(i) for i in issues], self.cache.ttl_issues)
        return issues

    async def get_issue_detail(self, repo: str, number: int) -> IssueInfo | None:
        cache_key = f"{repo}#{number}"
        cached = await self.cache.get("issue_detail", cache_key)
        if cached:
            return IssueInfo(**cached)

        url = f"{GITHUB}/{repo}/issues/{number}"
        status, body, _ = await self._get(url)
        if status != 200:
            return None

        soup = BeautifulSoup(body, "lxml")
        title_el = soup.select_one(".js-issue-title, .gh-header-title")
        title = title_el.get_text(strip=True) if title_el else f"Issue #{number}"
        body_el = soup.select_one(".comment-body, .js-comment-body")
        body_text = body_el.get_text(strip=True) if body_el else ""

        state = "closed"
        if soup.select_one('[title="Status: Open"], .State--open'):
            state = "open"

        labels: list[str] = []
        for lbl in soup.select(".IssueLabel, .label"):
            labels.append(lbl.get_text(strip=True))

        info = IssueInfo(
            number=number, title=title, body=body_text, state=state,
            html_url=f"{GITHUB}/{repo}/issues/{number}",
            created_at="", closed_at=None, user_login="",
            comments_count=0, labels=labels,
        )
        await self.cache.set("issue_detail", cache_key, self._issue_dict(info), self.cache.ttl_issues)
        return info

    async def get_issue_detail_api(self, repo: str, number: int) -> IssueInfo | None:
        """Fetch issue details via the REST API (more reliable than HTML scraping)."""
        cache_key = f"{repo}#{number}:api"
        cached = await self.cache.get("issue_detail", cache_key)
        if cached:
            return IssueInfo(**cached)

        data = await self._get_json(f"{API}/repos/{repo}/issues/{number}")
        if not data or not isinstance(data, dict):
            return None

        info = IssueInfo(
            number=number,
            title=data.get("title", f"Issue #{number}"),
            body=data.get("body") or "",
            state=data.get("state", "closed"),
            html_url=data.get("html_url", f"{GITHUB}/{repo}/issues/{number}"),
            created_at=data.get("created_at", ""),
            closed_at=data.get("closed_at"),
            user_login=data.get("user", {}).get("login", ""),
            comments_count=data.get("comments", 0),
            labels=[l.get("name", "") for l in data.get("labels", [])],
        )
        await self.cache.set("issue_detail", cache_key, self._issue_dict(info), self.cache.ttl_issues)
        return info

    # ── PR Operations ────────────────────────────────────────────

    async def get_linked_prs(self, repo: str, issue_number: int) -> list[int]:
        cache_key = f"{repo}#{issue_number}:prs"
        cached = await self.cache.get("linked_prs", cache_key)
        if cached:
            return cached

        # Use Timeline API only (no HTML scraping fallback to avoid secondary rate limits)
        pr_nums = await self._linked_prs_timeline(repo, issue_number)

        if pr_nums:
            await self.cache.set("linked_prs", cache_key, pr_nums, self.cache.ttl_issues)
        return pr_nums

    async def _linked_prs_timeline(self, repo: str, issue_number: int) -> list[int]:
        url = f"{API}/repos/{repo}/issues/{issue_number}/timeline"
        data = await self._get_json(url)
        if not data or not isinstance(data, list):
            return []

        pr_nums: set[int] = set()
        commit_shas: list[str] = []
        for event in data:
            etype = event.get("event", "")
            if etype == "cross-referenced":
                source = event.get("source", {}).get("issue", {})
                pr_data = source.get("pull_request")
                if pr_data:
                    m = _PR_NUM.search(pr_data.get("html_url", ""))
                    if m:
                        pr_nums.add(int(m.group(1)))
            elif etype == "closed":
                closer = event.get("source", {}) or {}
                closer_pr = closer.get("issue", {}).get("pull_request")
                if closer_pr:
                    m = _PR_NUM.search(closer_pr.get("html_url", ""))
                    if m:
                        pr_nums.add(int(m.group(1)))
                commit_id = event.get("commit_id")
                if commit_id and not pr_nums:
                    commit_shas.append(commit_id)

        # Resolve commit-based closures to PRs
        if not pr_nums and commit_shas:
            for sha in commit_shas[:2]:
                pr_data = await self._get_json(f"{API}/repos/{repo}/commits/{sha}/pulls")
                if pr_data and isinstance(pr_data, list):
                    for pr in pr_data:
                        num = pr.get("number")
                        if num:
                            pr_nums.add(num)
                if pr_nums:
                    break

        return sorted(pr_nums)

    async def get_pr_detail(self, repo: str, pr_number: int) -> PRAnalysis | None:
        cache_key = f"{repo}#{pr_number}"
        cached = await self.cache.get("pr_detail", cache_key)
        if cached:
            cached["files"] = [PRFileChange(**f) for f in cached.get("files", [])]
            return PRAnalysis(**cached)

        data = await self._get_json(f"{API}/repos/{repo}/pulls/{pr_number}")
        if not data or not isinstance(data, dict):
            return None

        body = data.get("body") or ""
        closes = [int(m) for m in _CLOSES_KW.findall(body)]
        base_sha = data.get("base", {}).get("sha")
        merged = data.get("merged", False)

        files = await self._get_pr_files(repo, pr_number)

        pr = PRAnalysis(
            number=pr_number,
            html_url=data.get("html_url", f"{GITHUB}/{repo}/pull/{pr_number}"),
            state=data.get("state", "closed"),
            merged=merged,
            body=body,
            files=files,
            closes_issues=closes,
            base_sha=base_sha,
        )
        # Cache with serializable files
        pr_cache = {
            "number": pr.number, "html_url": pr.html_url, "state": pr.state,
            "merged": pr.merged, "body": pr.body,
            "files": [{"filename": f.filename, "additions": f.additions, "deletions": f.deletions, "changes": f.changes, "patch": f.patch} for f in pr.files],
            "closes_issues": pr.closes_issues, "base_sha": pr.base_sha,
        }
        await self.cache.set("pr_detail", cache_key, pr_cache, self.cache.ttl_issues)
        return pr

    async def _get_pr_files(self, repo: str, pr_number: int) -> list[PRFileChange]:
        data = await self._get_json(f"{API}/repos/{repo}/pulls/{pr_number}/files")
        if not data or not isinstance(data, list):
            return []
        return [
            PRFileChange(
                filename=f["filename"],
                additions=f.get("additions", 0),
                deletions=f.get("deletions", 0),
                changes=f.get("changes", 0),
                patch=f.get("patch"),
            )
            for f in data
        ]

    # ── Batch Analysis ───────────────────────────────────────────

    async def analyze_issue(
        self,
        repo: str,
        issue: IssueInfo,
        profile: ScoringProfile | None = None,
    ) -> IssueAnalysisResult:
        """Analyze a single issue — fully async version of IssueAnalyzer.analyze_issue."""
        profile = profile or PR_WRITER_PROFILE
        reasons: list[str] = []
        details: dict = {}
        score = 0.0

        # Gate 1: must be closed
        if issue.state != "closed":
            return IssueAnalysisResult(issue=issue, pr_analysis=None, passes=False, reasons=["Issue is not closed"])

        # Fetch body if missing, or fix placeholder titles
        needs_detail = issue.body is None or issue.title.startswith("Issue #")
        if needs_detail:
            detail = await self.get_issue_detail_api(repo, issue.number)
            if not detail:
                detail = await self.get_issue_detail(repo, issue.number)
            if detail:
                issue = detail

        # Gate 2: pure body check (must have content AND no links/images)
        if profile.require_pure_body and not _body_is_pure_and_substantial(issue.body):
            if not issue.body or len((issue.body or "").strip()) < 20:
                reasons.append("Issue body is empty or too brief")
            else:
                reasons.append("Issue body contains links or images")
        else:
            score += profile.pure_body_score
            reasons.append("Body is pure text")

        # Gate 3: find linked PRs
        pr_nums = await self.get_linked_prs(repo, issue.number)
        if not pr_nums:
            reasons.append("No PR found that references this issue")
            return IssueAnalysisResult(issue=issue, pr_analysis=None, passes=False, reasons=reasons, details=details, score=score)

        # Gate 4: one-way closure
        best_pr: PRAnalysis | None = None
        for pr_num in pr_nums:
            pr = await self.get_pr_detail(repo, pr_num)
            if not pr:
                continue
            if issue.number not in pr.closes_issues:
                continue
            if profile.require_one_way_close and len(pr.closes_issues) > 1:
                reasons.append(f"PR #{pr_num} closes multiple issues: {pr.closes_issues}")
                continue
            best_pr = pr
            break

        if not best_pr:
            reasons.append("No PR with one-way close")
            return IssueAnalysisResult(issue=issue, pr_analysis=None, passes=False, reasons=reasons, details=details, score=score)

        # Score: code files
        lang = profile.required_language or "Python"
        code_files = _count_code_files(best_pr.files, lang)
        details["code_files_changed"] = code_files
        details["code_python_files_changed"] = code_files  # backward compat
        if code_files < profile.min_code_files_changed:
            reasons.append(f"Only {code_files} {lang} code files changed (need >= {profile.min_code_files_changed})")
        else:
            score += profile.code_files_score
            reasons.append(f"{code_files} {lang} code files changed")

        # Score: substantial changes
        if not _has_substantial_changes(best_pr.files, profile.min_substantial_changes, lang):
            reasons.append(f"No code file has >= {profile.min_substantial_changes} lines changed")
        else:
            score += profile.substantial_changes_score
            reasons.append("At least one code file has substantial changes")

        # Complexity hint
        total_adds = sum(f.additions for f in best_pr.files)
        total_dels = sum(f.deletions for f in best_pr.files)
        details["total_additions"] = total_adds
        details["total_deletions"] = total_dels
        total = total_adds + total_dels
        if total > 100:
            complexity = "High complexity"
        elif total > 50:
            complexity = "Medium-high complexity"
        elif total > 20:
            complexity = "Medium complexity"
        else:
            complexity = "May be too simple"

        # Title and body quality
        if len(issue.title) >= 10:
            score += profile.good_title_score
        else:
            reasons.append("Issue title may be too vague")

        if issue.body and len(issue.body) > 50:
            score += profile.good_description_score
            reasons.append("Issue has substantive description")
        elif not issue.body or len(issue.body) < 20:
            reasons.append("Issue description may be too brief")

        # Label boost
        if issue.labels and hasattr(profile, "label_boost_score"):
            pref = {l.lower() for l in profile.preferred_labels}
            matched = [l for l in issue.labels if l.lower() in pref]
            if matched:
                score += profile.label_boost_score
                reasons.append(f"Has preferred label: {', '.join(matched)}")

        # Recency boost
        if issue.closed_at and hasattr(profile, "recency_boost_score"):
            from datetime import datetime, timezone
            try:
                closed = datetime.fromisoformat(issue.closed_at.replace("Z", "+00:00"))
                age_months = (datetime.now(timezone.utc) - closed).days / 30.0
                if age_months <= profile.recency_months:
                    score += profile.recency_boost_score
                    reasons.append(f"Recent issue (closed {age_months:.0f} months ago)")
            except (ValueError, TypeError):
                pass

        passes = compute_passes(
            score, code_files, best_pr.files, issue.body, profile,
        )

        return IssueAnalysisResult(
            issue=issue, pr_analysis=best_pr, passes=passes,
            reasons=reasons, details=details, score=score,
            complexity_hint=complexity,
        )

    async def scan_repo(
        self,
        repo: str,
        profile: ScoringProfile | None = None,
        max_issues: int = 100,
        pre_filter=None,
        max_results: int = 10,
    ) -> list[IssueAnalysisResult]:
        """Scan a repo: list issues → pre-filter → analyze in batches with early exit."""
        profile = profile or PR_WRITER_PROFILE
        issues = await self.list_closed_issues(repo, max_issues=max_issues)

        # Apply pre-filter
        if pre_filter:
            issues = [i for i in issues if pre_filter(i, profile)]

        # Analyze in small batches to allow early exit
        passing: list[IssueAnalysisResult] = []
        batch_size = 10
        consecutive_misses = 0

        for i in range(0, len(issues), batch_size):
            batch = issues[i:i + batch_size]
            tasks = [self.analyze_issue(repo, issue, profile) for issue in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            batch_hits = 0
            for r in results:
                if isinstance(r, Exception):
                    log.debug("Analysis error: %s", r)
                    continue
                if r.passes and r.score >= profile.min_score:
                    passing.append(r)
                    batch_hits += 1

            if batch_hits > 0:
                consecutive_misses = 0
            else:
                consecutive_misses += 1

            # Early exit: stop after 2 consecutive batches with no hits,
            # or if we have enough results
            if len(passing) >= max_results:
                break
            if consecutive_misses >= 2 and len(passing) > 0:
                break
            if consecutive_misses >= 3:
                break

        passing.sort(key=lambda x: x.score, reverse=True)
        return passing

    async def scan_repos_parallel(
        self,
        repos: list[RepoInfo],
        profile: ScoringProfile | None = None,
        max_issues_per_repo: int = 50,
        pre_filter=None,
        on_repo_done=None,
    ) -> list[IssueAnalysisResult]:
        """Scan multiple repos in parallel."""
        profile = profile or PR_WRITER_PROFILE
        all_results: list[IssueAnalysisResult] = []

        async def _scan_one(repo: RepoInfo):
            try:
                enriched = await self.enrich_repo(repo)
                # Quick repo validation
                if enriched.size_kb > profile.max_size_mb * 1024:
                    return []
                if enriched.stars < profile.min_stars:
                    return []
                if profile.required_language:
                    target = profile.required_language.lower()
                    repo_lang = enriched.language.lower()
                    js_ts = {"javascript", "typescript"}
                    if repo_lang != target and not (repo_lang in js_ts and target in js_ts):
                        return []
                results = await self.scan_repo(
                    enriched.full_name, profile,
                    max_issues=max_issues_per_repo,
                    pre_filter=pre_filter,
                )
                if on_repo_done:
                    on_repo_done(enriched, results)
                return results
            except Exception as e:
                log.debug("Scan failed for %s: %s", repo.full_name, e)
                return []

        tasks = [_scan_one(r) for r in repos]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in batch_results:
            if isinstance(r, list):
                all_results.extend(r)

        all_results.sort(key=lambda x: x.score, reverse=True)
        return all_results

    # ── Helpers ───────────────────────────────────────────────────

    @staticmethod
    def _extract_repo_name(item: dict) -> str:
        repo_data = item.get("repo", {})
        name = repo_data.get("repository", {}).get("nwo", "")
        if not name:
            hl = item.get("hl_name", "")
            name = re.sub(r"<[^>]+>", "", hl)
        return name

    @staticmethod
    def _extract_language(item: dict) -> str:
        lang = item.get("language")
        if isinstance(lang, dict):
            return lang.get("name", "")
        return str(lang or "")

    @staticmethod
    def _repo_dict(r: RepoInfo) -> dict:
        return {
            "full_name": r.full_name, "stars": r.stars, "size_kb": r.size_kb,
            "language": r.language, "default_branch": r.default_branch,
            "html_url": r.html_url, "description": r.description,
            "pushed_at": r.pushed_at,
        }

    @staticmethod
    def _issue_dict(i: IssueInfo) -> dict:
        return {
            "number": i.number, "title": i.title, "body": i.body,
            "state": i.state, "html_url": i.html_url,
            "created_at": i.created_at, "closed_at": i.closed_at,
            "user_login": i.user_login, "comments_count": i.comments_count,
            "labels": i.labels,
        }

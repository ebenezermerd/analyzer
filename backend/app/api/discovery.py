"""Discovery, search, and repo endpoints."""

import time
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import get_current_user_id
from ..core.database import get_db
from ..models.user import User, ScanHistory, ScanResult
from ..services.github_service import GitHubService

router = APIRouter(prefix="/api", tags=["discovery"])


async def _get_service(
    user_id: int | None = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    profile: str = Query("pr_writer"),
    language: str = Query("Python"),
) -> GitHubService:
    token = None
    if user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.github_token:
            token = user.github_token
    svc = GitHubService(token=token, language=language)
    svc.set_profile(profile)
    return svc


async def _record_scan(
    db: AsyncSession,
    user_id: int | None,
    scan_type: str,
    query: str | None,
    repos_scanned: int,
    issues_found: int,
    issues_passed: int,
    profile: str,
    language: str,
    duration: float,
    results: list[dict] | None = None,
) -> ScanHistory | None:
    """Persist scan to history if user is authenticated."""
    if not user_id:
        return None
    scan = ScanHistory(
        user_id=user_id,
        scan_type=scan_type,
        query=query,
        repos_scanned=repos_scanned,
        issues_found=issues_found,
        issues_passed=issues_passed,
        profile=profile,
        language=language,
        duration_sec=duration,
    )
    db.add(scan)
    await db.flush()

    if results:
        for r in results:
            issue = r.get("issue", {})
            pr = r.get("pr") or {}
            db.add(ScanResult(
                scan_id=scan.id,
                repo=issue.get("html_url", "").split("github.com/")[-1].split("/issues")[0] if issue.get("html_url") else "",
                repo_stars=0,
                issue_number=issue.get("number", 0),
                issue_title=issue.get("title", ""),
                issue_url=issue.get("html_url", ""),
                pr_number=pr.get("number"),
                pr_url=pr.get("html_url"),
                score=r.get("score", 0),
                code_files_changed=r.get("details", {}).get("code_python_files_changed", r.get("details", {}).get("code_files_changed", 0)),
                total_additions=pr.get("total_additions", 0),
                total_deletions=pr.get("total_deletions", 0),
                complexity_hint=r.get("complexity_hint"),
                reasons=str(r.get("reasons", [])),
                base_sha=pr.get("base_sha"),
                passes=r.get("passes", False),
            ))
    await db.commit()
    return scan


@router.get("/discover")
async def discover(
    sources: str = Query("trending,topics,curated"),
    max_repos: int = Query(30, ge=1, le=100),
    profile: str = Query("pr_writer"),
    language: str = Query("Python"),
    service: GitHubService = Depends(_get_service),
    user_id: int | None = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    t0 = time.monotonic()
    src = tuple(s.strip() for s in sources.split(","))
    repos = await service.discover(sources=src, max_repos=max_repos)
    await service.close()
    dur = time.monotonic() - t0

    await _record_scan(db, user_id, "discover", ",".join(src), len(repos), 0, 0, profile, language, dur)
    return {"repos": repos, "total": len(repos), "sources": list(src)}


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    min_stars: int = Query(200, ge=0),
    max_results: int = Query(50, ge=1, le=100),
    profile: str = Query("pr_writer"),
    language: str = Query("Python"),
    service: GitHubService = Depends(_get_service),
    user_id: int | None = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    t0 = time.monotonic()
    repos = await service.search_repos(q, min_stars=min_stars, max_results=max_results)
    await service.close()
    dur = time.monotonic() - t0

    await _record_scan(db, user_id, "search", q, len(repos), 0, 0, profile, language, dur)
    return {"repos": repos, "total": len(repos), "query": q}


@router.get("/repo/{owner}/{name}")
async def get_repo(
    owner: str,
    name: str,
    service: GitHubService = Depends(_get_service),
):
    info = await service.get_repo(f"{owner}/{name}")
    await service.close()
    if not info:
        return {"error": "Repository not found"}
    return info


@router.get("/repo/{owner}/{name}/issues")
async def get_issues(
    owner: str,
    name: str,
    max_issues: int = Query(100, ge=1, le=500),
    smart_filter: bool = Query(True),
    service: GitHubService = Depends(_get_service),
):
    result = await service.get_issues(f"{owner}/{name}", max_issues=max_issues, smart_filter=smart_filter)
    await service.close()
    return result


@router.get("/repo/{owner}/{name}/issues/{issue_number}/analyze")
async def analyze_issue(
    owner: str,
    name: str,
    issue_number: int,
    service: GitHubService = Depends(_get_service),
):
    result = await service.analyze_issue(f"{owner}/{name}", issue_number)
    await service.close()
    return result


@router.get("/repo/{owner}/{name}/pr/{pr_number}/diff")
async def get_pr_diff(
    owner: str,
    name: str,
    pr_number: int,
    service: GitHubService = Depends(_get_service),
):
    files = await service.get_pr_diff(f"{owner}/{name}", pr_number)
    await service.close()
    return {"files": files, "total": len(files)}


@router.get("/repo/{owner}/{name}/scan")
async def scan_repo(
    owner: str,
    name: str,
    max_issues: int = Query(100, ge=1, le=500),
    profile: str = Query("pr_writer"),
    language: str = Query("Python"),
    service: GitHubService = Depends(_get_service),
    user_id: int | None = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    t0 = time.monotonic()
    results = await service.scan_repo(f"{owner}/{name}", max_issues=max_issues)
    await service.close()
    dur = time.monotonic() - t0

    result_dicts = results  # already dicts from service
    await _record_scan(
        db, user_id, "scan", f"{owner}/{name}",
        1, max_issues, len(results), profile, language, dur,
        results=result_dicts,
    )
    return {"results": results, "total": len(results)}


@router.get("/profiles")
async def get_profiles():
    return {"profiles": GitHubService.get_profiles()}

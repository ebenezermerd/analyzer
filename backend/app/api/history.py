"""Scan history and bookmarks endpoints."""

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import require_auth
from ..core.database import get_db
from ..models.user import ScanHistory, ScanResult, Bookmark

router = APIRouter(prefix="/api", tags=["history"])


class BookmarkRequest(BaseModel):
    repo: str
    issue_number: int
    issue_title: str
    issue_url: str
    score: float = 0.0
    notes: str = ""
    status: str = "saved"


class UpdateBookmarkRequest(BaseModel):
    status: str | None = None
    notes: str | None = None


# ── Scan History ─────────────────────────────────────────────

@router.get("/history")
async def get_history(
    limit: int = Query(50, ge=1, le=200),
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScanHistory)
        .where(ScanHistory.user_id == user_id)
        .order_by(desc(ScanHistory.created_at))
        .limit(limit)
    )
    scans = result.scalars().all()
    return {
        "scans": [
            {
                "id": s.id,
                "scan_type": s.scan_type,
                "query": s.query,
                "repos_scanned": s.repos_scanned,
                "issues_found": s.issues_found,
                "issues_passed": s.issues_passed,
                "profile": s.profile,
                "language": s.language,
                "duration_sec": s.duration_sec,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in scans
        ]
    }


@router.get("/history/{scan_id}/results")
async def get_scan_results(
    scan_id: int,
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    scan = await db.execute(
        select(ScanHistory).where(ScanHistory.id == scan_id, ScanHistory.user_id == user_id)
    )
    if not scan.scalar_one_or_none():
        raise HTTPException(status_code=404)

    result = await db.execute(
        select(ScanResult).where(ScanResult.scan_id == scan_id)
    )
    results = result.scalars().all()
    return {
        "results": [
            {
                "repo": r.repo,
                "repo_stars": r.repo_stars,
                "issue_number": r.issue_number,
                "issue_title": r.issue_title,
                "issue_url": r.issue_url,
                "pr_number": r.pr_number,
                "pr_url": r.pr_url,
                "score": r.score,
                "code_files_changed": r.code_files_changed,
                "complexity_hint": r.complexity_hint,
                "passes": r.passes,
                "reasons": json.loads(r.reasons) if r.reasons else [],
                "base_sha": r.base_sha,
            }
            for r in results
        ]
    }


# ── Analytics ────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    total_scans = await db.execute(
        select(func.count(ScanHistory.id)).where(ScanHistory.user_id == user_id)
    )
    total_issues = await db.execute(
        select(func.sum(ScanHistory.issues_passed)).where(ScanHistory.user_id == user_id)
    )
    by_type = await db.execute(
        select(ScanHistory.scan_type, func.count(ScanHistory.id))
        .where(ScanHistory.user_id == user_id)
        .group_by(ScanHistory.scan_type)
    )
    # Daily activity (last 30 days)
    from datetime import datetime, timedelta, timezone
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily = await db.execute(
        select(
            func.date(ScanHistory.created_at).label("day"),
            func.count(ScanHistory.id).label("scans"),
            func.coalesce(func.sum(ScanHistory.issues_passed), 0).label("issues"),
        )
        .where(ScanHistory.user_id == user_id, ScanHistory.created_at >= thirty_days_ago)
        .group_by(func.date(ScanHistory.created_at))
        .order_by(func.date(ScanHistory.created_at))
    )
    daily_rows = daily.all()

    # Top repos by results
    top_repos = await db.execute(
        select(
            ScanResult.repo,
            func.count(ScanResult.id).label("count"),
            func.avg(ScanResult.score).label("avg_score"),
        )
        .join(ScanHistory, ScanResult.scan_id == ScanHistory.id)
        .where(ScanHistory.user_id == user_id, ScanResult.passes == True)
        .group_by(ScanResult.repo)
        .order_by(desc("count"))
        .limit(10)
    )
    top_repos_rows = top_repos.all()

    recent = await db.execute(
        select(ScanHistory)
        .where(ScanHistory.user_id == user_id)
        .order_by(desc(ScanHistory.created_at))
        .limit(10)
    )

    return {
        "total_scans": total_scans.scalar() or 0,
        "total_issues_found": total_issues.scalar() or 0,
        "scans_by_type": dict(by_type.all()),
        "daily_activity": [
            {"day": str(r.day), "scans": r.scans, "issues": r.issues}
            for r in daily_rows
        ],
        "top_repos": [
            {"repo": r.repo, "count": r.count, "avg_score": round(float(r.avg_score or 0), 1)}
            for r in top_repos_rows
        ],
        "recent_scans": [
            {
                "id": s.id,
                "scan_type": s.scan_type,
                "query": s.query,
                "issues_passed": s.issues_passed,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in recent.scalars().all()
        ],
    }


# ── Bookmarks ────────────────────────────────────────────────

@router.get("/bookmarks")
async def get_bookmarks(
    status: str = Query(None),
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    q = select(Bookmark).where(Bookmark.user_id == user_id)
    if status:
        q = q.where(Bookmark.status == status)
    q = q.order_by(desc(Bookmark.created_at))
    result = await db.execute(q)
    return {
        "bookmarks": [
            {
                "id": b.id,
                "repo": b.repo,
                "issue_number": b.issue_number,
                "issue_title": b.issue_title,
                "issue_url": b.issue_url,
                "score": b.score,
                "notes": b.notes,
                "status": b.status,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in result.scalars().all()
        ]
    }


@router.post("/bookmarks")
async def create_bookmark(
    req: BookmarkRequest,
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    bm = Bookmark(user_id=user_id, **req.model_dump())
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return {"id": bm.id, "status": "created"}


@router.patch("/bookmarks/{bookmark_id}")
async def update_bookmark(
    bookmark_id: int,
    req: UpdateBookmarkRequest,
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == user_id)
    )
    bm = result.scalar_one_or_none()
    if not bm:
        raise HTTPException(status_code=404)
    if req.status is not None:
        bm.status = req.status
    if req.notes is not None:
        bm.notes = req.notes
    await db.commit()
    return {"status": "updated"}


@router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: int,
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == user_id)
    )
    bm = result.scalar_one_or_none()
    if not bm:
        raise HTTPException(status_code=404)
    await db.delete(bm)
    await db.commit()
    return {"status": "deleted"}

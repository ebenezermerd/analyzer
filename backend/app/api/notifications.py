"""Notification endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import require_auth
from ..core.database import get_db
from ..models.user import Notification

router = APIRouter(prefix="/api", tags=["notifications"])


@router.get("/notifications")
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    q = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        q = q.where(Notification.read == False)
    q = q.order_by(desc(Notification.created_at)).limit(limit)
    result = await db.execute(q)

    # Unread count
    count_q = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.read == False
        )
    )
    unread_count = count_q.scalar() or 0

    return {
        "notifications": [
            {
                "id": n.id,
                "repo": n.repo,
                "issue_number": n.issue_number,
                "issue_title": n.issue_title,
                "issue_url": n.issue_url,
                "message": n.message,
                "read": n.read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in result.scalars().all()
        ],
        "unread_count": unread_count,
    }


@router.patch("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: int,
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/notifications/read-all")
async def mark_all_read(
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/notifications/scan-bookmarks")
async def scan_bookmarks_for_updates(
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Scan bookmarked repos for new matching issues and create notifications."""
    from ..models.user import Bookmark, User
    from ..services.github_service import GitHubService
    import asyncio

    # Get user's token
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return {"status": "error", "message": "User not found"}

    # Get active bookmarks
    bm_result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == user_id, Bookmark.status.in_(["saved", "working"]))
    )
    bookmarks = bm_result.scalars().all()
    if not bookmarks:
        return {"status": "ok", "new_notifications": 0}

    # Group by repo
    repos = set(bm.repo for bm in bookmarks)
    bookmarked_issues = {f"{bm.repo}#{bm.issue_number}" for bm in bookmarks}

    service = GitHubService(token=user.github_token)
    new_count = 0

    try:
        for repo_name in repos:
            try:
                result = await service.get_issues(repo_name, max_issues=50, smart_filter=True)
                for issue in result.get("issues", []):
                    key = f"{repo_name}#{issue['number']}"
                    if key not in bookmarked_issues and issue.get("relevance", 0) >= 6:
                        # Check if notification already exists
                        existing = await db.execute(
                            select(Notification).where(
                                Notification.user_id == user_id,
                                Notification.repo == repo_name,
                                Notification.issue_number == issue["number"],
                            )
                        )
                        if existing.scalar_one_or_none():
                            continue

                        db.add(Notification(
                            user_id=user_id,
                            repo=repo_name,
                            issue_number=issue["number"],
                            issue_title=issue.get("title", ""),
                            issue_url=issue.get("html_url", ""),
                            message=f"New high-relevance issue in {repo_name}: #{issue['number']}",
                        ))
                        new_count += 1
            except Exception:
                continue

        await db.commit()
    finally:
        await service.close()

    return {"status": "ok", "new_notifications": new_count}

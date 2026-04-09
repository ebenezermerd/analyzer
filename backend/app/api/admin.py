"""Admin endpoints — all require admin role."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import hash_password, require_admin
from ..core.config import settings
from ..core.database import get_db
from ..core.email import send_claim_email, send_access_approved_email, send_access_denied_email
from ..models.user import User, AccessRequest, ClaimToken, ScanHistory

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Request / Response models ────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    created_at: str
    claimed_at: Optional[str] = None

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class InviteRequest(BaseModel):
    email: EmailStr

class AccessRequestOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    reason: Optional[str] = None
    status: str
    created_at: str
    reviewed_at: Optional[str] = None

class DashboardConfigOut(BaseModel):
    default_min_stars: int
    default_max_repos: int
    default_max_issues: int
    default_min_score: float
    default_concurrency: int

class DashboardConfigUpdate(BaseModel):
    default_min_stars: Optional[int] = None
    default_max_repos: Optional[int] = None
    default_max_issues: Optional[int] = None
    default_min_score: Optional[float] = None
    default_concurrency: Optional[int] = None


# ── User Management ──────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        query = query.where(User.email.ilike(f"%{search}%"))
        count_query = count_query.where(User.email.ilike(f"%{search}%"))
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "users": [
            UserOut(
                id=u.id,
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at.isoformat() if u.created_at else "",
                claimed_at=u.claimed_at.isoformat() if u.claimed_at else None,
            )
            for u in users
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get scan stats
    scan_count = (await db.execute(
        select(func.count(ScanHistory.id)).where(ScanHistory.user_id == user_id)
    )).scalar() or 0
    total_issues = (await db.execute(
        select(func.coalesce(func.sum(ScanHistory.issues_found), 0)).where(ScanHistory.user_id == user_id)
    )).scalar() or 0

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "has_github_token": bool(user.github_token),
        "created_at": user.created_at.isoformat() if user.created_at else "",
        "claimed_at": user.claimed_at.isoformat() if user.claimed_at else None,
        "scan_count": scan_count,
        "total_issues_found": total_issues,
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdate,
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if user_id == admin_id and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own admin role")
    if user_id == admin_id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    if body.role is not None:
        if body.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    return {"status": "ok"}


# ── Access Requests ──────────────────────────────────────────────────

@router.get("/access-requests")
async def list_access_requests(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(AccessRequest)
    count_query = select(func.count(AccessRequest.id))

    if status:
        query = query.where(AccessRequest.status == status)
        count_query = count_query.where(AccessRequest.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(AccessRequest.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    requests = result.scalars().all()

    return {
        "requests": [
            AccessRequestOut(
                id=r.id,
                email=r.email,
                name=r.name,
                reason=r.reason,
                status=r.status,
                created_at=r.created_at.isoformat() if r.created_at else "",
                reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
            )
            for r in requests
        ],
        "total": total,
    }


@router.post("/access-requests/{request_id}/approve")
async def approve_request(
    request_id: int,
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")

    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    # Create user stub
    user = User(
        email=req.email,
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        role="user",
        is_active=False,
    )
    db.add(user)
    await db.flush()

    # Generate claim token
    token = secrets.token_urlsafe(32)
    claim = ClaimToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.claim_token_expire_hours),
    )
    db.add(claim)

    # Update request
    req.status = "approved"
    req.reviewed_by = admin_id
    req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()

    await send_access_approved_email(req.email, token)
    return {"status": "approved", "email": req.email}


@router.post("/access-requests/{request_id}/deny")
async def deny_request(
    request_id: int,
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req.status}")

    req.status = "denied"
    req.reviewed_by = admin_id
    req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()

    await send_access_denied_email(req.email)
    return {"status": "denied", "email": req.email}


# ── Direct Invite ────────────────────────────────────────────────────

@router.post("/invite")
async def invite_user(
    body: InviteRequest,
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    # Create user stub
    user = User(
        email=body.email,
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        role="user",
        is_active=False,
    )
    db.add(user)
    await db.flush()

    # Generate claim token
    token = secrets.token_urlsafe(32)
    claim = ClaimToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.claim_token_expire_hours),
    )
    db.add(claim)
    await db.commit()

    await send_claim_email(body.email, token)
    return {"status": "invited", "email": body.email}


# ── Platform Analytics ───────────────────────────────────────────────

@router.get("/analytics")
async def platform_analytics(
    admin_id: int = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0
    total_scans = (await db.execute(select(func.count(ScanHistory.id)))).scalar() or 0
    total_issues = (await db.execute(
        select(func.coalesce(func.sum(ScanHistory.issues_found), 0))
    )).scalar() or 0
    pending_requests = (await db.execute(
        select(func.count(AccessRequest.id)).where(AccessRequest.status == "pending")
    )).scalar() or 0

    # Daily activity (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_result = await db.execute(
        select(
            func.date(ScanHistory.created_at).label("day"),
            func.count(ScanHistory.id).label("scans"),
            func.coalesce(func.sum(ScanHistory.issues_found), 0).label("issues"),
        )
        .where(ScanHistory.created_at >= thirty_days_ago)
        .group_by(func.date(ScanHistory.created_at))
        .order_by(func.date(ScanHistory.created_at))
    )
    daily_activity = [{"day": str(row.day), "scans": row.scans, "issues": row.issues} for row in daily_result]

    # Top users by scan count
    top_users_result = await db.execute(
        select(
            User.email,
            func.count(ScanHistory.id).label("scan_count"),
        )
        .join(ScanHistory, ScanHistory.user_id == User.id)
        .group_by(User.id, User.email)
        .order_by(func.count(ScanHistory.id).desc())
        .limit(10)
    )
    top_users = [{"email": row.email, "scan_count": row.scan_count} for row in top_users_result]

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_scans": total_scans,
        "total_issues_found": total_issues,
        "pending_requests": pending_requests,
        "daily_activity": daily_activity,
        "top_users": top_users,
    }


# ── Dashboard Config ─────────────────────────────────────────────────

@router.get("/dashboard-config")
async def get_dashboard_config(admin_id: int = Depends(require_admin)):
    return DashboardConfigOut(
        default_min_stars=settings.default_min_stars,
        default_max_repos=settings.default_max_repos,
        default_max_issues=settings.default_max_issues,
        default_min_score=settings.default_min_score,
        default_concurrency=settings.default_concurrency,
    )


@router.patch("/dashboard-config")
async def update_dashboard_config(
    body: DashboardConfigUpdate,
    admin_id: int = Depends(require_admin),
):
    # Update in-memory settings (persists until server restart)
    if body.default_min_stars is not None:
        settings.default_min_stars = body.default_min_stars
    if body.default_max_repos is not None:
        settings.default_max_repos = body.default_max_repos
    if body.default_max_issues is not None:
        settings.default_max_issues = body.default_max_issues
    if body.default_min_score is not None:
        settings.default_min_score = body.default_min_score
    if body.default_concurrency is not None:
        settings.default_concurrency = body.default_concurrency

    return {"status": "ok"}

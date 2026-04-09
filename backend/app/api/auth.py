"""Authentication endpoints."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth import hash_password, verify_password, create_access_token, require_auth
from ..core.config import settings
from ..core.database import get_db
from ..core.email import send_claim_email
from ..models.user import User, AccessRequest, ClaimToken

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    role: str


class SetTokenRequest(BaseModel):
    github_token: str


class RequestAccessBody(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    reason: Optional[str] = None


class ClaimBody(BaseModel):
    token: str
    password: str
    email: Optional[EmailStr] = None


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    raise HTTPException(
        status_code=403,
        detail="Registration is disabled. Please request access instead.",
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account not yet activated. Please check your email for a claim link.")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user_id=user.id, email=user.email, role=user.role)


@router.get("/me")
async def get_me(user_id: int = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "has_github_token": bool(user.github_token),
        "role": user.role,
        "is_active": user.is_active,
    }


@router.post("/github-token")
async def set_github_token(
    req: SetTokenRequest,
    user_id: int = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)
    user.github_token = req.github_token
    await db.commit()
    return {"status": "ok"}


@router.post("/request-access")
async def request_access(req: RequestAccessBody, db: AsyncSession = Depends(get_db)):
    # Check if email already has a user account
    existing_user = await db.execute(select(User).where(User.email == req.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Check if there's already a pending request
    existing_req = await db.execute(
        select(AccessRequest).where(AccessRequest.email == req.email, AccessRequest.status == "pending")
    )
    if existing_req.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An access request for this email is already pending")

    access_req = AccessRequest(email=req.email, name=req.name, reason=req.reason)
    db.add(access_req)
    await db.commit()
    return {"message": "Access request submitted. You will receive an email when approved."}


@router.get("/claim/{token}")
async def validate_claim(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClaimToken).where(ClaimToken.token == token))
    claim = result.scalar_one_or_none()
    if not claim or claim.used:
        raise HTTPException(status_code=404, detail="Invalid or expired claim token")
    if claim.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Claim token has expired")

    user_result = await db.execute(select(User).where(User.id == claim.user_id))
    user = user_result.scalar_one_or_none()
    return {"valid": True, "email": user.email if user else ""}


@router.post("/claim")
async def claim_account(req: ClaimBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClaimToken).where(ClaimToken.token == req.token))
    claim = result.scalar_one_or_none()
    if not claim or claim.used:
        raise HTTPException(status_code=400, detail="Invalid or already used claim token")
    if claim.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Claim token has expired")

    user_result = await db.execute(select(User).where(User.id == claim.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update user
    user.hashed_password = hash_password(req.password)
    if req.email:
        # Check email isn't taken by another user
        existing = await db.execute(select(User).where(User.email == req.email, User.id != user.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = req.email
    user.is_active = True
    user.claimed_at = datetime.now(timezone.utc)

    # Mark token as used
    claim.used = True
    await db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user_id=user.id, email=user.email, role=user.role)

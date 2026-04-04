"""GitHub OAuth login flow."""

import secrets
from urllib.parse import urlencode

import aiohttp
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from ..core.config import settings
from ..core.auth import create_access_token, hash_password
from ..core.database import get_db
from ..models.user import User

router = APIRouter(prefix="/auth", tags=["oauth"])

# In-memory state store (production: use Redis)
_oauth_states: set[str] = set()


class OAuthUrlResponse(BaseModel):
    url: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class OAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    github_username: str


@router.get("/github/url", response_model=OAuthUrlResponse)
async def github_oauth_url():
    """Generate GitHub OAuth authorization URL."""
    if not settings.github_client_id:
        raise HTTPException(400, "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env")

    state = secrets.token_urlsafe(32)
    _oauth_states.add(state)

    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_oauth_redirect,
        "scope": "read:user user:email repo",
        "state": state,
    }
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return OAuthUrlResponse(url=url)


@router.post("/github/callback", response_model=OAuthTokenResponse)
async def github_oauth_callback(
    req: OAuthCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange OAuth code for token, create/login user."""
    if req.state not in _oauth_states:
        raise HTTPException(400, "Invalid OAuth state")
    _oauth_states.discard(req.state)

    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(400, "GitHub OAuth not configured")

    # Exchange code for access token
    async with aiohttp.ClientSession() as session:
        resp = await session.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": req.code,
                "redirect_uri": settings.github_oauth_redirect,
            },
            headers={"Accept": "application/json"},
        )
        data = await resp.json()

    github_token = data.get("access_token")
    if not github_token:
        raise HTTPException(400, f"GitHub OAuth failed: {data.get('error_description', 'unknown error')}")

    # Get GitHub user info
    async with aiohttp.ClientSession() as session:
        resp = await session.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {github_token}", "Accept": "application/json"},
        )
        user_data = await resp.json()

        # Get email if not public
        email = user_data.get("email")
        if not email:
            resp2 = await session.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {github_token}", "Accept": "application/json"},
            )
            emails = await resp2.json()
            if isinstance(emails, list):
                primary = next((e for e in emails if e.get("primary")), None)
                email = primary["email"] if primary else (emails[0]["email"] if emails else None)

    if not email:
        raise HTTPException(400, "Could not retrieve email from GitHub")

    username = user_data.get("login", "")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # random password for OAuth users
            github_token=github_token,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update token
        user.github_token = github_token
        await db.commit()

    jwt = create_access_token({"sub": str(user.id)})
    return OAuthTokenResponse(
        access_token=jwt,
        user_id=user.id,
        email=email,
        github_username=username,
    )

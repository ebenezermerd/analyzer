"""Seed the first admin account on startup."""

import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .auth import hash_password
from .config import settings
from .database import async_session
from .email import send_claim_email

logger = logging.getLogger(__name__)


async def seed_admin():
    """Create the initial admin account stub if no admin exists."""
    from ..models.user import User, ClaimToken

    async with async_session() as db:
        # Check if any admin already exists
        result = await db.execute(select(User).where(User.role == "admin"))
        if result.scalar_one_or_none():
            logger.info("Admin user already exists — skipping seed")
            return

        # Check if the admin email already exists as a regular user — promote them
        existing = await db.execute(select(User).where(User.email == settings.admin_email))
        user = existing.scalar_one_or_none()

        if user:
            user.role = "admin"
            user.is_active = False
            logger.info(f"Promoted existing user {settings.admin_email} to admin")
        else:
            user = User(
                email=settings.admin_email,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                role="admin",
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

        claim_url = f"{settings.frontend_url}/auth/claim?token={token}"
        logger.info(f"Admin account created for {settings.admin_email}")
        logger.info(f"Claim URL: {claim_url}")

        await send_claim_email(settings.admin_email, token)

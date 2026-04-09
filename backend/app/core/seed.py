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
        # Check if any admin already exists and is active — truly done
        result = await db.execute(select(User).where(User.role == "admin", User.is_active == True))
        if result.scalar_one_or_none():
            print("[SEED] Admin user already active — skipping seed")
            return

        # Check if admin exists but is inactive (needs claim token)
        result2 = await db.execute(select(User).where(User.role == "admin", User.is_active == False))
        user = result2.scalar_one_or_none()

        if not user:
            # Check if the admin email exists as a regular user — promote them
            existing = await db.execute(select(User).where(User.email == settings.admin_email))
            user = existing.scalar_one_or_none()

            if user:
                user.role = "admin"
                user.is_active = False
                print(f"[SEED] Promoted existing user {settings.admin_email} to admin")
            else:
                user = User(
                    email=settings.admin_email,
                    hashed_password=hash_password(secrets.token_urlsafe(32)),
                    role="admin",
                    is_active=False,
                )
                db.add(user)
                print(f"[SEED] Created admin stub for {settings.admin_email}")

        await db.flush()

        # Generate a fresh claim token (invalidates old ones)
        token = secrets.token_urlsafe(32)
        claim = ClaimToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.claim_token_expire_hours),
        )
        db.add(claim)
        await db.commit()

        claim_url = f"{settings.frontend_url}/auth/claim?token={token}"
        print(f"[SEED] ==============================")
        print(f"[SEED] Admin claim URL: {claim_url}")
        print(f"[SEED] ==============================")

        await send_claim_email(settings.admin_email, token)

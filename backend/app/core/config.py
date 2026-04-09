"""Application configuration."""

import os
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Issue Finder API"
    debug: bool = False

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Database — pydantic reads DATABASE_URL from env automatically
    database_url: str = f"sqlite+aiosqlite:///{Path('/tmp') / 'issue_finder_web.db'}"

    # GitHub defaults
    default_min_stars: int = 200
    default_max_repos: int = 50
    default_max_issues: int = 100
    default_min_score: float = 5.0
    default_concurrency: int = 10

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_oauth_redirect: str = "https://pranalyzer.vercel.app/auth/callback"

    # Email (SMTP for claim tokens & notifications)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@pranalyzer.vercel.app"
    smtp_use_tls: bool = True

    # Admin seed
    admin_email: str = "ebenezermerd@gmail.com"

    # Frontend URL (for claim links in emails)
    frontend_url: str = "https://pranalyzer.vercel.app"

    # Claim token expiry
    claim_token_expire_hours: int = 72

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://pranalyzer.vercel.app",
    ]

    @model_validator(mode="after")
    def normalize_database_url(self) -> "Settings":
        """Ensure async driver is used — Neon emits postgres:// or postgresql://
        but SQLAlchemy needs postgresql+asyncpg:// for async."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        # asyncpg doesn't understand sslmode= param — replace with ssl=require
        url = url.replace("?sslmode=require", "?ssl=require")
        url = url.replace("&sslmode=require", "&ssl=require")
        self.database_url = url
        return self

    class Config:
        env_file = ".env"


settings = Settings()

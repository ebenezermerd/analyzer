"""Application configuration."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings

# ── Database URL resolution ──────────────────────────────────
# Priority: DATABASE_URL env var (Neon/Postgres) → SQLite fallback
_raw_db = os.environ.get("DATABASE_URL", "")
if _raw_db:
    if _raw_db.startswith("postgres://"):
        _db_url = "postgresql+asyncpg://" + _raw_db[len("postgres://"):]
    elif _raw_db.startswith("postgresql://") and "+asyncpg" not in _raw_db:
        _db_url = "postgresql+asyncpg://" + _raw_db[len("postgresql://"):]
    else:
        _db_url = _raw_db
else:
    _db_url = f"sqlite+aiosqlite:///{Path('/tmp') / 'issue_finder_web.db'}"


class Settings(BaseSettings):
    app_name: str = "Issue Finder API"
    debug: bool = False

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Database
    database_url: str = _db_url

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

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://pranalyzer.vercel.app",
    ]

    class Config:
        env_file = ".env"


settings = Settings()

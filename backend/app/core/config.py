"""Application configuration."""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "Issue Finder API"
    debug: bool = False

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Database
    database_url: str = f"sqlite+aiosqlite:///{Path.home() / '.issue_finder' / 'web.db'}"

    # GitHub defaults
    default_min_stars: int = 200
    default_max_repos: int = 50
    default_max_issues: int = 100
    default_min_score: float = 5.0
    default_concurrency: int = 10

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_oauth_redirect: str = "http://localhost:3000/auth/callback"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://pranalyzer.vercel.app",
    ]

    class Config:
        env_file = ".env"


settings = Settings()

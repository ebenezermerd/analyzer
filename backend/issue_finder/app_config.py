"""Application configuration loader and validator."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 fallback
    import tomli as tomllib


DEFAULT_CONFIG_LOCATIONS = (
    Path("config.toml"),
    Path.home() / ".issue_finder" / "config.toml",
)


@dataclass
class AppConfig:
    """Resolved runtime configuration."""

    config_path: Path | None = None
    default_profile: str = "pr_writer"
    default_language: str = "Python"
    min_stars: int = 200
    max_repos: int = 50
    max_issues_per_repo: int = 100
    min_score: float = 5.0

    token_concurrency: int = 10
    no_token_concurrency: int = 2
    token_throttle_sec: float = 0.15
    no_token_throttle_sec: float = 1.0

    request_timeout_sec: int = 20
    retry_attempts: int = 3
    retry_base_delay_ms: int = 300
    retry_max_delay_ms: int = 5000
    retry_jitter: bool = True

    cache_enabled: bool = True
    cache_dir: Path = Path.home() / ".issue_finder" / "cache"
    ttl_search_sec: int = 3600
    ttl_issues_sec: int = 86400
    ttl_repo_sec: int = 86400
    ttl_trending_sec: int = 7200

    exclude_words: tuple[str, ...] = (
        "collection",
        "list",
        "guide",
        "projects",
        "exercises",
    )


class ConfigError(ValueError):
    """Configuration parsing/validation error."""


def _get(dct: dict[str, Any], *keys: str, default: Any = None) -> Any:
    cur: Any = dct
    for key in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def _to_int(v: Any, name: str) -> int:
    if isinstance(v, bool):
        raise ConfigError(f"{name} must be an integer, got boolean")
    try:
        return int(v)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{name} must be an integer") from exc


def _to_float(v: Any, name: str) -> float:
    if isinstance(v, bool):
        raise ConfigError(f"{name} must be a number, got boolean")
    try:
        return float(v)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{name} must be a number") from exc


def _to_bool(v: Any, name: str) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        val = v.strip().lower()
        if val in {"1", "true", "yes", "on"}:
            return True
        if val in {"0", "false", "no", "off"}:
            return False
    raise ConfigError(f"{name} must be a boolean")


def _resolve_config_path(config_path: str | None) -> Path | None:
    if config_path:
        p = Path(config_path).expanduser()
        if not p.exists():
            raise ConfigError(f"Config file not found: {p}")
        return p

    env_path = os.environ.get("ISSUE_FINDER_CONFIG")
    if env_path:
        p = Path(env_path).expanduser()
        return p if p.exists() else None

    for p in DEFAULT_CONFIG_LOCATIONS:
        if p.exists():
            return p
    return None


def _validate(cfg: AppConfig) -> None:
    if cfg.min_stars < 0:
        raise ConfigError("discovery.min_stars must be >= 0")
    if cfg.max_repos < 1:
        raise ConfigError("discovery.max_repos must be >= 1")
    if cfg.max_issues_per_repo < 1:
        raise ConfigError("discovery.max_issues_per_repo must be >= 1")
    if cfg.min_score < 0:
        raise ConfigError("ranking.min_score must be >= 0")
    if cfg.token_concurrency < 1 or cfg.token_concurrency > 64:
        raise ConfigError("rate_limit.token_concurrency must be in [1, 64]")
    if cfg.no_token_concurrency < 1 or cfg.no_token_concurrency > 64:
        raise ConfigError("rate_limit.no_token_concurrency must be in [1, 64]")
    if cfg.request_timeout_sec < 1:
        raise ConfigError("network.request_timeout_sec must be >= 1")
    if cfg.retry_attempts < 0 or cfg.retry_attempts > 10:
        raise ConfigError("network.retry_attempts must be in [0, 10]")
    if cfg.retry_base_delay_ms < 0:
        raise ConfigError("network.retry_base_delay_ms must be >= 0")
    if cfg.retry_max_delay_ms < cfg.retry_base_delay_ms:
        raise ConfigError("network.retry_max_delay_ms must be >= retry_base_delay_ms")


def load_app_config(config_path: str | None = None) -> AppConfig:
    """Load AppConfig from TOML file and env overrides."""
    cfg = AppConfig()
    resolved = _resolve_config_path(config_path)
    raw: dict[str, Any] = {}

    if resolved:
        try:
            raw = tomllib.loads(resolved.read_text(encoding="utf-8"))
        except OSError as exc:
            raise ConfigError(f"Cannot read config file: {resolved}") from exc
        except Exception as exc:  # tomllib raises TOMLDecodeError
            raise ConfigError(f"Invalid TOML in config file: {resolved}") from exc
        cfg.config_path = resolved

    profile_env = os.environ.get("ISSUE_FINDER_PROFILE")
    if profile_env:
        cfg.default_profile = profile_env.strip()
    else:
        cfg.default_profile = str(_get(raw, "app", "default_profile", default=cfg.default_profile))

    lang_env = os.environ.get("ISSUE_FINDER_LANGUAGE")
    if lang_env:
        cfg.default_language = lang_env.strip()
    else:
        cfg.default_language = str(_get(raw, "app", "default_language", default=cfg.default_language))

    cfg.min_stars = _to_int(_get(raw, "discovery", "min_stars", default=cfg.min_stars), "discovery.min_stars")
    cfg.max_repos = _to_int(_get(raw, "discovery", "max_repos", default=cfg.max_repos), "discovery.max_repos")
    cfg.max_issues_per_repo = _to_int(
        _get(raw, "discovery", "max_issues_per_repo", default=cfg.max_issues_per_repo),
        "discovery.max_issues_per_repo",
    )
    cfg.min_score = _to_float(_get(raw, "ranking", "min_score", default=cfg.min_score), "ranking.min_score")

    cfg.token_concurrency = _to_int(
        _get(raw, "rate_limit", "token_concurrency", default=cfg.token_concurrency),
        "rate_limit.token_concurrency",
    )
    cfg.no_token_concurrency = _to_int(
        _get(raw, "rate_limit", "no_token_concurrency", default=cfg.no_token_concurrency),
        "rate_limit.no_token_concurrency",
    )
    cfg.token_throttle_sec = _to_float(
        _get(raw, "rate_limit", "token_throttle_sec", default=cfg.token_throttle_sec),
        "rate_limit.token_throttle_sec",
    )
    cfg.no_token_throttle_sec = _to_float(
        _get(raw, "rate_limit", "no_token_throttle_sec", default=cfg.no_token_throttle_sec),
        "rate_limit.no_token_throttle_sec",
    )

    cfg.request_timeout_sec = _to_int(
        _get(raw, "network", "request_timeout_sec", default=cfg.request_timeout_sec),
        "network.request_timeout_sec",
    )
    cfg.retry_attempts = _to_int(
        _get(raw, "network", "retry_attempts", default=cfg.retry_attempts),
        "network.retry_attempts",
    )
    cfg.retry_base_delay_ms = _to_int(
        _get(raw, "network", "retry_base_delay_ms", default=cfg.retry_base_delay_ms),
        "network.retry_base_delay_ms",
    )
    cfg.retry_max_delay_ms = _to_int(
        _get(raw, "network", "retry_max_delay_ms", default=cfg.retry_max_delay_ms),
        "network.retry_max_delay_ms",
    )
    cfg.retry_jitter = _to_bool(
        _get(raw, "network", "jitter", default=cfg.retry_jitter),
        "network.jitter",
    )

    cfg.cache_enabled = _to_bool(
        _get(raw, "cache", "enabled", default=cfg.cache_enabled),
        "cache.enabled",
    )
    env_cache_disabled = os.environ.get("ISSUE_FINDER_CACHE_DISABLED")
    if env_cache_disabled is not None and env_cache_disabled.strip():
        cfg.cache_enabled = not _to_bool(env_cache_disabled, "ISSUE_FINDER_CACHE_DISABLED")
    cache_dir = _get(raw, "cache", "path", default=str(cfg.cache_dir))
    cfg.cache_dir = Path(str(cache_dir)).expanduser()
    cfg.ttl_search_sec = _to_int(_get(raw, "cache", "ttl_search_sec", default=cfg.ttl_search_sec), "cache.ttl_search_sec")
    cfg.ttl_issues_sec = _to_int(_get(raw, "cache", "ttl_issue_sec", default=cfg.ttl_issues_sec), "cache.ttl_issue_sec")
    cfg.ttl_repo_sec = _to_int(_get(raw, "cache", "ttl_repo_sec", default=cfg.ttl_repo_sec), "cache.ttl_repo_sec")
    cfg.ttl_trending_sec = _to_int(_get(raw, "cache", "ttl_trending_sec", default=cfg.ttl_trending_sec), "cache.ttl_trending_sec")

    exclude_words = _get(raw, "filters", "exclude_words", default=list(cfg.exclude_words))
    if not isinstance(exclude_words, list) or not all(isinstance(x, str) for x in exclude_words):
        raise ConfigError("filters.exclude_words must be an array of strings")
    cfg.exclude_words = tuple(x.strip() for x in exclude_words if x.strip())

    _validate(cfg)
    return cfg

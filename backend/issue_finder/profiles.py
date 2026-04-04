"""Scoring profiles for issue analysis."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .config import (
    SUPPORTED_LANGUAGES,
    TEST_FILE_PATTERNS_BY_LANG,
    DOC_FILE_PATTERNS_BY_LANG,
)


PROFILES_DIR = Path.home() / ".issue_finder" / "profiles"


@dataclass
class ScoringProfile:
    """Configurable scoring criteria for issue analysis."""

    name: str
    description: str = ""

    # Repository gates
    min_stars: int = 200
    max_size_mb: int = 200
    required_language: str = "Python"

    # Issue gates
    require_closed: bool = True
    require_pure_body: bool = True
    require_one_way_close: bool = True

    # File change thresholds
    min_code_files_changed: int = 4
    min_substantial_changes: int = 5

    # Scoring weights
    pure_body_score: float = 2.0
    code_files_score: float = 3.0
    substantial_changes_score: float = 2.0
    good_title_score: float = 0.5
    good_description_score: float = 0.5
    label_boost_score: float = 0.5
    recency_boost_score: float = 0.5
    recency_months: int = 18

    # Minimum total score to pass
    min_score: float = 5.0

    # File patterns
    test_patterns: tuple[str, ...] = (
        "test_", "_test", "tests/", "/test/", "conftest.py",
        "unittest", "pytest", "spec.py",
    )
    doc_patterns: tuple[str, ...] = (
        "readme", "changelog", "docs/", ".md", ".rst", ".txt",
        "license", "contributing", "setup.cfg", "pyproject.toml",
    )

    # Label-based pre-filtering
    preferred_labels: list[str] = field(default_factory=lambda: [
        "bug", "enhancement", "feature", "refactor", "improvement",
    ])
    skip_labels: list[str] = field(default_factory=lambda: [
        "duplicate", "wontfix", "invalid", "question", "documentation",
        "dependencies", "stale",
    ])

    def with_language(self, language: str) -> "ScoringProfile":
        """Return a copy of this profile configured for the given language."""
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {language}. Supported: {SUPPORTED_LANGUAGES}")
        return ScoringProfile(
            name=self.name,
            description=self.description,
            min_stars=self.min_stars,
            max_size_mb=self.max_size_mb,
            required_language=language,
            require_closed=self.require_closed,
            require_pure_body=self.require_pure_body,
            require_one_way_close=self.require_one_way_close,
            min_code_files_changed=self.min_code_files_changed,
            min_substantial_changes=self.min_substantial_changes,
            pure_body_score=self.pure_body_score,
            code_files_score=self.code_files_score,
            substantial_changes_score=self.substantial_changes_score,
            good_title_score=self.good_title_score,
            good_description_score=self.good_description_score,
            min_score=self.min_score,
            test_patterns=TEST_FILE_PATTERNS_BY_LANG.get(language, self.test_patterns),
            doc_patterns=DOC_FILE_PATTERNS_BY_LANG.get(language, self.doc_patterns),
            preferred_labels=list(self.preferred_labels),
            skip_labels=list(self.skip_labels),
        )

    def to_dict(self) -> dict:
        d = {}
        for k, v in self.__dict__.items():
            if isinstance(v, tuple):
                d[k] = list(v)
            else:
                d[k] = v
        return d

    def save(self, path: Path | None = None) -> Path:
        path = path or PROFILES_DIR / f"{self.name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2))
        return path


# Built-in profiles — Python (default)
PR_WRITER_PROFILE = ScoringProfile(
    name="pr_writer",
    description="PR Writer HFI project criteria (default, Python)",
)

GENERAL_PROFILE = ScoringProfile(
    name="general",
    description="General-purpose issue discovery (relaxed criteria)",
    min_stars=50,
    max_size_mb=500,
    require_pure_body=False,
    require_one_way_close=False,
    min_code_files_changed=2,
    min_substantial_changes=3,
    min_score=3.0,
)

# Built-in profiles — JavaScript
PR_WRITER_JS_PROFILE = ScoringProfile(
    name="pr_writer_js",
    description="PR Writer HFI project criteria (JavaScript)",
    required_language="JavaScript",
    test_patterns=TEST_FILE_PATTERNS_BY_LANG["JavaScript"],
    doc_patterns=DOC_FILE_PATTERNS_BY_LANG["JavaScript"],
)

GENERAL_JS_PROFILE = ScoringProfile(
    name="general_js",
    description="General-purpose issue discovery (JavaScript, relaxed)",
    required_language="JavaScript",
    min_stars=50,
    max_size_mb=500,
    require_pure_body=False,
    require_one_way_close=False,
    min_code_files_changed=2,
    min_substantial_changes=3,
    min_score=3.0,
    test_patterns=TEST_FILE_PATTERNS_BY_LANG["JavaScript"],
    doc_patterns=DOC_FILE_PATTERNS_BY_LANG["JavaScript"],
)

# Built-in profiles — TypeScript
PR_WRITER_TS_PROFILE = ScoringProfile(
    name="pr_writer_ts",
    description="PR Writer HFI project criteria (TypeScript)",
    required_language="TypeScript",
    test_patterns=TEST_FILE_PATTERNS_BY_LANG["TypeScript"],
    doc_patterns=DOC_FILE_PATTERNS_BY_LANG["TypeScript"],
)

GENERAL_TS_PROFILE = ScoringProfile(
    name="general_ts",
    description="General-purpose issue discovery (TypeScript, relaxed)",
    required_language="TypeScript",
    min_stars=50,
    max_size_mb=500,
    require_pure_body=False,
    require_one_way_close=False,
    min_code_files_changed=2,
    min_substantial_changes=3,
    min_score=3.0,
    test_patterns=TEST_FILE_PATTERNS_BY_LANG["TypeScript"],
    doc_patterns=DOC_FILE_PATTERNS_BY_LANG["TypeScript"],
)

BUILTIN_PROFILES: dict[str, ScoringProfile] = {
    "pr_writer": PR_WRITER_PROFILE,
    "general": GENERAL_PROFILE,
    "pr_writer_js": PR_WRITER_JS_PROFILE,
    "general_js": GENERAL_JS_PROFILE,
    "pr_writer_ts": PR_WRITER_TS_PROFILE,
    "general_ts": GENERAL_TS_PROFILE,
}


def load_profile(name_or_path: str) -> ScoringProfile:
    """Load a profile by built-in name or JSON file path."""
    if name_or_path in BUILTIN_PROFILES:
        return BUILTIN_PROFILES[name_or_path]

    path = Path(name_or_path)
    if not path.exists():
        path = PROFILES_DIR / f"{name_or_path}.json"

    if path.exists():
        data = json.loads(path.read_text())
        for k in ("test_patterns", "doc_patterns"):
            if k in data and isinstance(data[k], list):
                data[k] = tuple(data[k])
        return ScoringProfile(**data)

    raise ValueError(f"Unknown profile: {name_or_path}")


def list_profiles() -> list[ScoringProfile]:
    """List all available profiles (built-in + custom)."""
    profiles = list(BUILTIN_PROFILES.values())
    if PROFILES_DIR.exists():
        for f in PROFILES_DIR.glob("*.json"):
            try:
                p = load_profile(str(f))
                if p.name not in BUILTIN_PROFILES:
                    profiles.append(p)
            except Exception:
                pass
    return profiles

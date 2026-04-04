"""Repository analysis for PR Writer compatibility."""

from __future__ import annotations

from dataclasses import dataclass, field

from .config import REPO_MAX_SIZE_MB, REPO_MIN_STARS, REPO_SIZE_KB, SUPPORTED_LANGUAGES
from .github_client import RepoInfo


@dataclass
class RepoAnalysisResult:
    """Result of repository analysis."""

    repo: RepoInfo
    passes: bool
    reasons: list[str] = field(default_factory=list)
    score: float = 0.0

    @property
    def summary(self) -> str:
        return "; ".join(self.reasons) if self.reasons else "OK"


def analyze_repo(repo: RepoInfo, language: str = "Python") -> RepoAnalysisResult:
    """Analyze if a repository meets PR Writer criteria."""
    reasons = []
    score = 0.0

    # Size: must be <= 200 MB
    if repo.size_kb > REPO_SIZE_KB:
        reasons.append(f"Size {repo.size_kb / 1024:.1f}MB > {REPO_MAX_SIZE_MB}MB")
    else:
        score += 2.0
        reasons.append(f"Size OK ({repo.size_kb / 1024:.1f}MB)")

    # Stars: >= 200
    if repo.stars < REPO_MIN_STARS:
        reasons.append(f"Stars {repo.stars} < {REPO_MIN_STARS}")
    else:
        score += 2.0
        if repo.stars >= 1000:
            score += 1.0
        reasons.append(f"Stars OK ({repo.stars})")

    # Language check — supports JavaScript and TypeScript interchangeably
    repo_lang = (repo.language or "").lower()
    target_lang = language.lower()

    # JS and TS are often mixed in repos, so treat them as compatible
    js_ts_group = {"javascript", "typescript"}
    lang_match = (
        repo_lang == target_lang
        or (repo_lang in js_ts_group and target_lang in js_ts_group)
    )

    if not repo_lang:
        reasons.append("Language not detected")
    elif not lang_match:
        reasons.append(f"Not primary {language} (language: {repo.language})")
    else:
        score += 1.0
        reasons.append(f"{repo.language} repo")

    passes = repo.size_kb <= REPO_SIZE_KB and repo.stars >= REPO_MIN_STARS

    return RepoAnalysisResult(repo=repo, passes=passes, reasons=reasons, score=score)

"""Issue analysis for PR Writer HFI project criteria."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .config import (
    DOC_FILE_PATTERNS,
    MIN_CODE_FILES_CHANGED,
    MIN_SUBSTANTIAL_CHANGES_IN_FILE,
    NOISE_TITLE_PATTERNS,
    TEST_FILE_PATTERNS,
    URL_PATTERN,
    get_code_extensions,
    get_test_patterns,
    get_doc_patterns,
)
from .github_client import GitHubClient, IssueInfo, PRFileChange, PRAnalysis
from .profiles import PR_WRITER_PROFILE

# Legacy alias
MIN_PYTHON_FILES_CHANGED = MIN_CODE_FILES_CHANGED


def _is_test_file(filename: str, language: str | None = None) -> bool:
    """Check if file is a test file."""
    fn = filename.lower()
    patterns = get_test_patterns(language) if language else TEST_FILE_PATTERNS
    return any(p in fn for p in patterns)


def _is_doc_file(filename: str, language: str | None = None) -> bool:
    """Check if file is documentation."""
    fn = filename.lower()
    patterns = get_doc_patterns(language) if language else DOC_FILE_PATTERNS
    return any(p in fn for p in patterns)


def _is_code_file(filename: str, language: str = "Python") -> bool:
    """Check if file is a code file for the given language (not test, not doc)."""
    extensions = get_code_extensions(language)
    if not any(filename.endswith(ext) for ext in extensions):
        return False
    if _is_test_file(filename, language):
        return False
    if _is_doc_file(filename, language):
        return False
    return True


# Legacy alias
def _is_code_python_file(filename: str) -> bool:
    """Check if file is a Python code file (not test, not doc)."""
    return _is_code_file(filename, "Python")


def _body_has_links_or_images(body: str | None) -> bool:
    """Check if issue body contains URLs or markdown images."""
    if not body or not body.strip():
        return False
    return bool(URL_PATTERN.search(body))


def _strip_markdown(text: str) -> str:
    """Remove markdown formatting for consistent length estimation."""
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`]+`', '', text)
    text = re.sub(r'[#*_~>]', '', text)
    return text.strip()


def _body_is_pure_and_substantial(body: str | None, min_length: int = 20) -> bool:
    """Body must have real content AND no links/images to qualify as pure.

    Empty/null bodies return False — they should not earn a pure_body score.
    """
    if not body or len(_strip_markdown(body)) < min_length:
        return False
    return not _body_has_links_or_images(body)


def _body_is_pure_text(body: str | None) -> bool:
    """Issue description should be pure - no images, no links."""
    return not _body_has_links_or_images(body)


def _has_substantial_changes(files: list[PRFileChange], min_changes: int = 5, language: str = "Python") -> bool:
    """At least one code file should have substantial changes."""
    for f in files:
        if not _is_code_file(f.filename, language):
            continue
        total = f.additions + f.deletions
        if total >= min_changes:
            return True
    return False


def _count_code_files(files: list[PRFileChange], language: str = "Python") -> int:
    """Count code files changed (excluding test and doc) for the given language."""
    return sum(1 for f in files if _is_code_file(f.filename, language))


# Legacy alias
def _count_code_python_files(files: list[PRFileChange]) -> int:
    """Count Python code files changed (excluding test and doc)."""
    return _count_code_files(files, "Python")


def compute_passes(
    score: float,
    code_files: int,
    files: list[PRFileChange],
    body: str | None,
    profile,
) -> bool:
    """Single source of truth for pass/fail determination."""
    if score < profile.min_score:
        return False
    if code_files < profile.min_code_files_changed:
        return False
    if not _has_substantial_changes(files, profile.min_substantial_changes):
        return False
    if profile.require_pure_body and not _body_is_pure_and_substantial(body):
        return False
    return True


def pre_filter(issue: IssueInfo, profile=None) -> bool:
    """Quick check using only issue metadata -- no API calls needed.

    Skips issues with noise titles, skip-labels, or non-closed state.
    Saves expensive PR lookups by eliminating obvious non-candidates.
    """
    if issue.state != "closed":
        return False

    # Skip noise titles
    title_lower = issue.title.lower()
    if any(p in title_lower for p in NOISE_TITLE_PATTERNS):
        return False

    # Skip by label if profile provided
    if profile is not None:
        skip = {l.lower() for l in profile.skip_labels}
        if any(l.lower() in skip for l in issue.labels):
            return False

    return True


@dataclass
class IssueAnalysisResult:
    """Result of issue analysis."""

    issue: IssueInfo
    pr_analysis: PRAnalysis | None
    passes: bool
    reasons: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)
    score: float = 0.0
    complexity_hint: str = ""

    @property
    def summary(self) -> str:
        return "; ".join(self.reasons) if self.reasons else "OK"


class IssueAnalyzer:
    """Analyzes issues against PR Writer criteria."""

    def __init__(self, client: GitHubClient, language: str = "Python"):
        self.client = client
        self.language = language

    def analyze_issue(
        self, full_name: str, issue: IssueInfo, analyze_pr: bool = True
    ) -> IssueAnalysisResult:
        """Analyze an issue against all PR Writer criteria."""
        reasons = []
        details = {}
        score = 0.0
        lang = self.language
        lang_label = lang

        # 1. Issue must be closed
        if issue.state != "closed":
            return IssueAnalysisResult(
                issue=issue,
                pr_analysis=None,
                passes=False,
                reasons=["Issue is not closed"],
            )

        # 2. Body must be pure - no images, no links, and substantial
        if not _body_is_pure_and_substantial(issue.body):
            if not issue.body or len((issue.body or "").strip()) < 20:
                reasons.append("Issue body is empty or too brief")
            else:
                reasons.append("Issue body contains links or images (must be pure text)")
        else:
            score += 2.0
            reasons.append("Body is pure text")

        # 3. Find linked PR
        prs = self.client.get_prs_linked_to_issue(full_name, issue.number)
        if not prs:
            reasons.append("No PR found that references this issue")
            return IssueAnalysisResult(
                issue=issue,
                pr_analysis=None,
                passes=False,
                reasons=reasons,
                details=details,
                score=score,
            )

        # 4. One-way link: PR should close only this issue
        best_pr = None
        best_pr_analysis = None

        for pr in prs:
            body = self.client.get_pr_body(full_name, pr.number)
            closes = GitHubClient.parse_closes_keywords(body, issue.number)
            if issue.number not in closes:
                continue
            if len(closes) > 1:
                reasons.append(f"PR closes multiple issues: {closes}")
                continue
            files = self.client.get_pr_files(full_name, pr.number)
            base_sha = self.client.get_pr_base_sha(full_name, pr.number)
            pr_analysis = PRAnalysis(
                number=pr.number,
                html_url=pr.html_url,
                state=pr.state,
                merged=pr.merged,
                body=body,
                files=files,
                closes_issues=closes,
                base_sha=base_sha,
            )
            best_pr = pr
            best_pr_analysis = pr_analysis
            break

        if not best_pr_analysis:
            reasons.append("No PR with one-way close (closes only this issue)")
            return IssueAnalysisResult(
                issue=issue,
                pr_analysis=None,
                passes=False,
                reasons=reasons,
                details=details,
                score=score,
            )

        # 5. At least N code files changed (excluding test/docs)
        code_files = _count_code_files(best_pr_analysis.files, lang)
        details["code_files_changed"] = code_files
        details["code_python_files_changed"] = code_files  # backward compat
        if code_files < MIN_CODE_FILES_CHANGED:
            reasons.append(
                f"Only {code_files} {lang_label} code files changed (need >= {MIN_CODE_FILES_CHANGED})"
            )
        else:
            score += 3.0
            reasons.append(f"{code_files} {lang_label} code files changed")

        # 6. At least one code file with substantial changes
        if not _has_substantial_changes(
            best_pr_analysis.files, MIN_SUBSTANTIAL_CHANGES_IN_FILE, lang
        ):
            reasons.append(
                f"No code file has >= {MIN_SUBSTANTIAL_CHANGES_IN_FILE} lines changed"
            )
        else:
            score += 2.0
            reasons.append("At least one code file has substantial changes")

        # Complexity hint based on changes
        total_additions = sum(f.additions for f in best_pr_analysis.files)
        total_deletions = sum(f.deletions for f in best_pr_analysis.files)
        details["total_additions"] = total_additions
        details["total_deletions"] = total_deletions

        if total_additions + total_deletions > 100:
            complexity_hint = "High complexity"
        elif total_additions + total_deletions > 50:
            complexity_hint = "Medium-high complexity"
        elif total_additions + total_deletions > 20:
            complexity_hint = "Medium complexity"
        else:
            complexity_hint = "May be too simple (model might solve in 1-2 turns)"

        # Well-scoped check: title length and body length
        if len(issue.title) < 10:
            reasons.append("Issue title may be too vague")
        else:
            score += 0.5

        if issue.body and len(issue.body) > 50:
            score += 0.5
            reasons.append("Issue has substantive description")
        elif not issue.body or len(issue.body) < 20:
            reasons.append("Issue description may be too brief")

        # Label boost
        if issue.labels:
            pref = {l.lower() for l in PR_WRITER_PROFILE.preferred_labels}
            matched = [l for l in issue.labels if l.lower() in pref]
            if matched:
                score += PR_WRITER_PROFILE.label_boost_score
                reasons.append(f"Has preferred label: {', '.join(matched)}")

        # Recency boost
        if issue.closed_at:
            from datetime import datetime, timezone
            try:
                closed = datetime.fromisoformat(issue.closed_at.replace("Z", "+00:00"))
                age_months = (datetime.now(timezone.utc) - closed).days / 30.0
                if age_months <= PR_WRITER_PROFILE.recency_months:
                    score += PR_WRITER_PROFILE.recency_boost_score
                    reasons.append(f"Recent issue (closed {age_months:.0f} months ago)")
            except (ValueError, TypeError):
                pass

        passes = compute_passes(
            score, code_files, best_pr_analysis.files, issue.body,
            PR_WRITER_PROFILE,
        )

        return IssueAnalysisResult(
            issue=issue,
            pr_analysis=best_pr_analysis,
            passes=passes,
            reasons=reasons,
            details=details,
            score=score,
            complexity_hint=complexity_hint,
        )

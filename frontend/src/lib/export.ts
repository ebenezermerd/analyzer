import type { Issue, AnalysisResult } from "./api";

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Export Issues ────────────────────────────────────────────

export function exportIssuesJSON(issues: Issue[], repo: string) {
  const data = issues.map((i) => ({
    repo,
    issue_number: i.number,
    title: i.title,
    url: i.html_url,
    state: i.state,
    labels: i.labels,
    relevance: i.relevance,
    has_pr: i.metrics.has_pr,
    code_files: i.metrics.py_files,
    body_pure: i.metrics.body_pure,
  }));
  downloadFile(JSON.stringify(data, null, 2), `issues-${repo.replace("/", "-")}.json`, "application/json");
}

export function exportIssuesCSV(issues: Issue[], repo: string) {
  const headers = ["repo", "issue_number", "title", "url", "labels", "relevance", "has_pr", "code_files", "body_pure"];
  const rows = issues.map((i) => [
    repo,
    i.number,
    `"${i.title.replace(/"/g, '""')}"`,
    i.html_url,
    `"${i.labels.join(", ")}"`,
    i.relevance,
    i.metrics.has_pr ?? "",
    i.metrics.py_files ?? "",
    i.metrics.body_pure ?? "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, `issues-${repo.replace("/", "-")}.csv`, "text/csv");
}

// ── Export Analysis Results ─────────────────────────────────

export function exportAnalysisJSON(results: AnalysisResult[]) {
  const data = results.map((r) => ({
    repo: r.issue.html_url.split("github.com/")[1]?.split("/issues")[0] || "",
    issue_number: r.issue.number,
    title: r.issue.title,
    url: r.issue.html_url,
    score: r.score,
    passes: r.passes,
    complexity: r.complexity_hint,
    reasons: r.reasons,
    pr_number: r.pr?.number ?? null,
    pr_url: r.pr?.html_url ?? null,
    base_sha: r.pr?.base_sha ?? null,
    code_files: r.details?.code_python_files_changed ?? r.details?.code_files_changed ?? 0,
    additions: r.pr?.total_additions ?? 0,
    deletions: r.pr?.total_deletions ?? 0,
  }));
  downloadFile(JSON.stringify(data, null, 2), "analysis-results.json", "application/json");
}

export function exportAnalysisCSV(results: AnalysisResult[]) {
  const headers = [
    "repo", "issue_number", "title", "url", "score", "passes", "complexity",
    "pr_number", "pr_url", "base_sha", "code_files", "additions", "deletions",
  ];
  const rows = results.map((r) => {
    const repo = r.issue.html_url.split("github.com/")[1]?.split("/issues")[0] || "";
    return [
      repo,
      r.issue.number,
      `"${r.issue.title.replace(/"/g, '""')}"`,
      r.issue.html_url,
      r.score,
      r.passes,
      r.complexity_hint,
      r.pr?.number ?? "",
      r.pr?.html_url ?? "",
      r.pr?.base_sha ?? "",
      r.details?.code_python_files_changed ?? r.details?.code_files_changed ?? 0,
      r.pr?.total_additions ?? 0,
      r.pr?.total_deletions ?? 0,
    ];
  });
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, "analysis-results.csv", "text/csv");
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// Auth
export const auth = {
  register: (email: string, password: string) =>
    fetchAPI<{ access_token: string; user_id: number; email: string; role: string }>("/auth/register", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    fetchAPI<{ access_token: string; user_id: number; email: string; role: string }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => fetchAPI<{ id: number; email: string; has_github_token: boolean; role: string; is_active: boolean }>("/auth/me"),
  setGithubToken: (github_token: string) =>
    fetchAPI("/auth/github-token", { method: "POST", body: JSON.stringify({ github_token }) }),
  requestAccess: (email: string, name?: string, reason?: string) =>
    fetchAPI<{ message: string }>("/auth/request-access", {
      method: "POST", body: JSON.stringify({ email, name, reason }),
    }),
  validateClaim: (token: string) =>
    fetchAPI<{ valid: boolean; email: string }>(`/auth/claim/${token}`),
  claim: (token: string, password: string, email?: string) =>
    fetchAPI<{ access_token: string; user_id: number; email: string; role: string }>("/auth/claim", {
      method: "POST", body: JSON.stringify({ token, password, email }),
    }),
};

// Helper to read all preferences from persisted store
function getPrefs(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(localStorage.getItem("issue-finder-storage") || "{}");
    const s = stored?.state || {};
    return {
      profile: s.activeProfile || "pr_writer",
      language: s.language || "Python",
      min_stars: String(s.minStars ?? 200),
      max_repos: String(s.maxRepos ?? 30),
      max_issues: String(s.maxIssues ?? 100),
      min_score: String(s.minScore ?? 5.0),
    };
  } catch {
    return {};
  }
}

function withPrefs(base: string, extra?: Record<string, string>): string {
  const prefs = { ...getPrefs(), ...extra };
  // Don't duplicate params already in the URL
  const existingParams = new Set<string>();
  const qIdx = base.indexOf("?");
  if (qIdx !== -1) {
    new URLSearchParams(base.slice(qIdx + 1)).forEach((_, k) => existingParams.add(k));
  }
  const newParams = new URLSearchParams();
  for (const [k, v] of Object.entries(prefs)) {
    if (!existingParams.has(k)) newParams.set(k, v);
  }
  const qs = newParams.toString();
  if (!qs) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${qs}`;
}

// Discovery & Search — params from arguments take priority, withPrefs fills in the rest
export const discovery = {
  discover: (sources = "trending,topics,curated", maxRepos?: number) => {
    const p = getPrefs();
    const mr = maxRepos ?? (Number(p.max_repos) || 30);
    return fetchAPI<{ repos: Repo[]; total: number }>(withPrefs(`/api/discover?sources=${sources}&max_repos=${mr}`));
  },
  search: (q: string, minStars?: number, maxResults?: number) => {
    const p = getPrefs();
    const ms = minStars ?? (Number(p.min_stars) || 200);
    const mr = maxResults ?? (Number(p.max_repos) || 50);
    return fetchAPI<{ repos: Repo[]; total: number }>(withPrefs(`/api/search?q=${encodeURIComponent(q)}&min_stars=${ms}&max_results=${mr}`));
  },
  getRepo: (owner: string, name: string) =>
    fetchAPI<Repo>(withPrefs(`/api/repo/${owner}/${name}`)),
  getIssues: (owner: string, name: string, smartFilter = true, maxIssues?: number) => {
    const p = getPrefs();
    const mi = maxIssues ?? (Number(p.max_issues) || 100);
    return fetchAPI<IssuesResponse>(withPrefs(`/api/repo/${owner}/${name}/issues?smart_filter=${smartFilter}&max_issues=${mi}`));
  },
  analyzeIssue: (owner: string, name: string, issueNumber: number) =>
    fetchAPI<AnalysisResult>(withPrefs(`/api/repo/${owner}/${name}/issues/${issueNumber}/analyze`)),
  scanRepo: (owner: string, name: string, maxIssues?: number) => {
    const p = getPrefs();
    const mi = maxIssues ?? (Number(p.max_issues) || 100);
    return fetchAPI<{ results: AnalysisResult[]; total: number }>(withPrefs(`/api/repo/${owner}/${name}/scan?max_issues=${mi}`));
  },
  getProfiles: () => fetchAPI<{ profiles: Profile[] }>("/api/profiles"),
  getPrDiff: (owner: string, name: string, prNumber: number) =>
    fetchAPI<{ files: PrFileDiff[]; total: number }>(`/api/repo/${owner}/${name}/pr/${prNumber}/diff`),
};

// GitHub OAuth
export const oauth = {
  getAuthUrl: () => fetchAPI<{ url: string }>("/auth/github/url"),
  callback: (code: string, state: string) =>
    fetchAPI<{ access_token: string; user_id: number; email: string; github_username: string }>(
      "/auth/github/callback", { method: "POST", body: JSON.stringify({ code, state }) }
    ),
};

// History & Bookmarks
export const history = {
  getHistory: (limit = 50) => fetchAPI<{ scans: ScanRecord[] }>(`/api/history?limit=${limit}`),
  getScanResults: (scanId: number) => fetchAPI<{ results: ScanResultRecord[] }>(`/api/history/${scanId}/results`),
  getAnalytics: () => fetchAPI<Analytics>("/api/analytics"),
  getBookmarks: (status?: string) =>
    fetchAPI<{ bookmarks: Bookmark[] }>(`/api/bookmarks${status ? `?status=${status}` : ""}`),
  createBookmark: (data: CreateBookmarkData) =>
    fetchAPI("/api/bookmarks", { method: "POST", body: JSON.stringify(data) }),
  updateBookmark: (id: number, data: { status?: string; notes?: string }) =>
    fetchAPI(`/api/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBookmark: (id: number) =>
    fetchAPI(`/api/bookmarks/${id}`, { method: "DELETE" }),
};

// Notifications
export const notificationsApi = {
  getNotifications: (unreadOnly = false, limit = 20) =>
    fetchAPI<{ notifications: NotificationItem[]; unread_count: number }>(
      `/api/notifications?unread_only=${unreadOnly}&limit=${limit}`
    ),
  markRead: (id: number) =>
    fetchAPI(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    fetchAPI("/api/notifications/read-all", { method: "POST" }),
  scanBookmarks: () =>
    fetchAPI<{ status: string; new_notifications: number }>("/api/notifications/scan-bookmarks", { method: "POST" }),
};

// WebSocket helper
export function createWS(path: string, params?: Record<string, string>): WebSocket {
  const base = API_BASE.replace("http", "ws");
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return new WebSocket(`${base}${path}${qs}`);
}

// Types
export interface Repo {
  full_name: string;
  stars: number;
  size_mb: number;
  language: string;
  default_branch: string;
  html_url: string;
  description: string | null;
  pushed_at: string | null;
}

export interface IssueMetrics {
  has_pr: boolean | null;
  pr_count: number;
  py_files: number | null;
  body_pure: boolean | null;
  pre_filter: boolean;
}

export interface Issue {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  user_login: string;
  comments_count: number;
  labels: string[];
  metrics: IssueMetrics;
  relevance: number;
}

export interface IssuesResponse {
  total: number;
  filtered: number;
  issues: Issue[];
}

export interface AnalysisResult {
  issue: {
    number: number;
    title: string;
    body: string;
    html_url: string;
    labels: string[];
    created_at: string;
    closed_at: string | null;
  };
  passes: boolean;
  score: number;
  reasons: string[];
  complexity_hint: string;
  details: Record<string, number>;
  pr: {
    number: number;
    html_url: string;
    state: string;
    merged: boolean;
    closes_issues: number[];
    base_sha: string | null;
    files_count: number;
    total_additions: number;
    total_deletions: number;
  } | null;
}

export interface Profile {
  name: string;
  description: string;
  min_stars: number;
  min_score: number;
  language: string;
}

export interface ScanRecord {
  id: number;
  scan_type: string;
  query: string | null;
  repos_scanned: number;
  issues_found: number;
  issues_passed: number;
  profile: string;
  language: string;
  duration_sec: number;
  created_at: string;
}

export interface ScanResultRecord {
  repo: string;
  repo_stars: number;
  issue_number: number;
  issue_title: string;
  issue_url: string;
  pr_number: number | null;
  pr_url: string | null;
  score: number;
  code_files_changed: number;
  complexity_hint: string;
  passes: boolean;
  reasons: string[];
  base_sha: string | null;
}

export interface Analytics {
  total_scans: number;
  total_issues_found: number;
  scans_by_type: Record<string, number>;
  daily_activity: { day: string; scans: number; issues: number }[];
  top_repos: { repo: string; count: number; avg_score: number }[];
  recent_scans: { id: number; scan_type: string; query: string | null; issues_passed: number; created_at: string }[];
}

export interface Bookmark {
  id: number;
  repo: string;
  issue_number: number;
  issue_title: string;
  issue_url: string;
  score: number;
  notes: string;
  status: string;
  created_at: string;
}

export interface CreateBookmarkData {
  repo: string;
  issue_number: number;
  issue_title: string;
  issue_url: string;
  score?: number;
  notes?: string;
  status?: string;
}

export interface NotificationItem {
  id: number;
  repo: string;
  issue_number: number | null;
  issue_title: string | null;
  issue_url: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface PrFileDiff {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
}

// Admin types
export interface AdminUser {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  claimed_at: string | null;
}

export interface AdminUserDetail extends AdminUser {
  has_github_token: boolean;
  scan_count: number;
  total_issues_found: number;
}

export interface AccessRequestItem {
  id: number;
  email: string;
  name: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface PlatformAnalytics {
  total_users: number;
  active_users: number;
  total_scans: number;
  total_issues_found: number;
  pending_requests: number;
  daily_activity: { day: string; scans: number; issues: number }[];
  top_users: { email: string; scan_count: number }[];
}

export interface DashboardConfig {
  default_min_stars: number;
  default_max_repos: number;
  default_max_issues: number;
  default_min_score: number;
  default_concurrency: number;
}

// Admin API
export const adminApi = {
  getUsers: (params?: { search?: string; role?: string; is_active?: string; page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.role) qs.set("role", params.role);
    if (params?.is_active) qs.set("is_active", params.is_active);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    return fetchAPI<{ users: AdminUser[]; total: number; page: number; per_page: number }>(`/admin/users?${qs}`);
  },
  getUser: (id: number) => fetchAPI<AdminUserDetail>(`/admin/users/${id}`),
  updateUser: (id: number, data: { role?: string; is_active?: boolean }) =>
    fetchAPI(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getAccessRequests: (status?: string) =>
    fetchAPI<{ requests: AccessRequestItem[]; total: number }>(`/admin/access-requests${status ? `?status=${status}` : ""}`),
  approveRequest: (id: number) =>
    fetchAPI<{ status: string; email: string }>(`/admin/access-requests/${id}/approve`, { method: "POST" }),
  denyRequest: (id: number) =>
    fetchAPI<{ status: string; email: string }>(`/admin/access-requests/${id}/deny`, { method: "POST" }),
  invite: (email: string) =>
    fetchAPI<{ status: string; email: string }>("/admin/invite", { method: "POST", body: JSON.stringify({ email }) }),
  getAnalytics: () => fetchAPI<PlatformAnalytics>("/admin/analytics"),
  getDashboardConfig: () => fetchAPI<DashboardConfig>("/admin/dashboard-config"),
  updateDashboardConfig: (data: Partial<DashboardConfig>) =>
    fetchAPI("/admin/dashboard-config", { method: "PATCH", body: JSON.stringify(data) }),
};

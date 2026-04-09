import { useQuery } from "@tanstack/react-query";
import { discovery, history as historyApi, notificationsApi, auth as authApi, adminApi } from "./api";
import { useStore } from "./store";
import type { Repo, IssuesResponse, AnalysisResult, Profile } from "./api";

// ── Keys ────────────────────────────────────────────────────────────
export const keys = {
  discover: (sources: string, profile: string, lang: string) =>
    ["discover", sources, profile, lang] as const,
  search: (q: string, profile: string, lang: string) =>
    ["search", q, profile, lang] as const,
  repo: (name: string) => ["repo", name] as const,
  issues: (repo: string, smartFilter: boolean, profile: string) =>
    ["issues", repo, smartFilter, profile] as const,
  analyze: (repo: string, issueNum: number) =>
    ["analyze", repo, issueNum] as const,
  scan: (repo: string, profile: string) =>
    ["scan", repo, profile] as const,
  profiles: ["profiles"] as const,
  history: (limit: number) => ["history", limit] as const,
  scanResults: (scanId: number) => ["scanResults", scanId] as const,
  prDiff: (repo: string, prNum: number) =>
    ["prDiff", repo, prNum] as const,
  analytics: ["analytics"] as const,
  bookmarks: (status?: string) => ["bookmarks", status] as const,
  notifications: ["notifications"] as const,
  me: ["me"] as const,
};

// ── Discovery & Search ──────────────────────────────────────────────
export function useDiscoverRepos(sources: string, enabled = false) {
  const { activeProfile, language } = useStore();
  return useQuery({
    queryKey: keys.discover(sources, activeProfile, language),
    queryFn: () => discovery.discover(sources, 30),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useSearchRepos(query: string, enabled = false) {
  const { activeProfile, language } = useStore();
  return useQuery({
    queryKey: keys.search(query, activeProfile, language),
    queryFn: () => discovery.search(query),
    enabled: enabled && query.length > 0,
    staleTime: 60 * 1000,
  });
}

// ── Repo ────────────────────────────────────────────────────────────
export function useRepo(fullName: string | null) {
  return useQuery({
    queryKey: keys.repo(fullName || ""),
    queryFn: () => {
      const [owner, name] = fullName!.split("/");
      return discovery.getRepo(owner, name);
    },
    enabled: !!fullName,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRepoIssues(
  repoFullName: string | null,
  smartFilter = true,
  enabled = true,
) {
  const { activeProfile } = useStore();
  return useQuery<IssuesResponse>({
    queryKey: keys.issues(repoFullName || "", smartFilter, activeProfile),
    queryFn: () => {
      const [owner, name] = repoFullName!.split("/");
      return discovery.getIssues(owner, name, smartFilter);
    },
    enabled: enabled && !!repoFullName,
    staleTime: 30 * 1000,
  });
}

export function useAnalyzeIssue(
  repoFullName: string | null,
  issueNumber: number | null,
) {
  return useQuery<AnalysisResult>({
    queryKey: keys.analyze(repoFullName || "", issueNumber || 0),
    queryFn: () => {
      const [owner, name] = repoFullName!.split("/");
      return discovery.analyzeIssue(owner, name, issueNumber!);
    },
    enabled: !!repoFullName && !!issueNumber,
    staleTime: 5 * 60 * 1000,
  });
}

export function useScanRepo(repoFullName: string | null, enabled = false) {
  const { activeProfile } = useStore();
  return useQuery({
    queryKey: keys.scan(repoFullName || "", activeProfile),
    queryFn: () => {
      const [owner, name] = repoFullName!.split("/");
      return discovery.scanRepo(owner, name);
    },
    enabled: enabled && !!repoFullName,
  });
}

// ── Profiles ────────────────────────────────────────────────────────
export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: () => discovery.getProfiles(),
    staleTime: Infinity,
  });
}

// ── History & Analytics ─────────────────────────────────────────────
export function useScanHistory(limit = 50) {
  return useQuery({
    queryKey: keys.history(limit),
    queryFn: () => historyApi.getHistory(limit),
  });
}

export function useScanResults(scanId: number | null) {
  return useQuery({
    queryKey: keys.scanResults(scanId || 0),
    queryFn: () => historyApi.getScanResults(scanId!),
    enabled: !!scanId,
  });
}

export function usePrDiff(repoFullName: string | null, prNumber: number | null) {
  return useQuery({
    queryKey: keys.prDiff(repoFullName || "", prNumber || 0),
    queryFn: () => {
      const [owner, name] = repoFullName!.split("/");
      return discovery.getPrDiff(owner, name, prNumber!);
    },
    enabled: !!repoFullName && !!prNumber,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: keys.analytics,
    queryFn: () => historyApi.getAnalytics(),
  });
}

export function useBookmarks(status?: string) {
  return useQuery({
    queryKey: keys.bookmarks(status),
    queryFn: () => historyApi.getBookmarks(status),
  });
}

// ── Auth ─────────────────────────────────────────────────────────────
export function useNotifications() {
  const { token } = useStore();
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => notificationsApi.getNotifications(),
    enabled: !!token,
    refetchInterval: 60 * 1000, // poll every minute
  });
}

export function useMe() {
  const { token } = useStore();
  return useQuery({
    queryKey: keys.me,
    queryFn: () => authApi.me(),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Admin ────────────────────────────────────────────────────────────
export const adminKeys = {
  users: (params?: Record<string, string | undefined>) => ["admin-users", params] as const,
  accessRequests: (status?: string) => ["admin-access-requests", status] as const,
  analytics: ["admin-analytics"] as const,
  dashboardConfig: ["admin-dashboard-config"] as const,
};

export function useAdminUsers(params?: { search?: string; role?: string; is_active?: string; page?: number }) {
  const { role } = useStore();
  return useQuery({
    queryKey: adminKeys.users(params as Record<string, string | undefined>),
    queryFn: () => adminApi.getUsers(params),
    enabled: role === "admin",
  });
}

export function useAdminAccessRequests(status?: string) {
  const { role } = useStore();
  return useQuery({
    queryKey: adminKeys.accessRequests(status),
    queryFn: () => adminApi.getAccessRequests(status),
    enabled: role === "admin",
  });
}

export function useAdminAnalytics() {
  const { role } = useStore();
  return useQuery({
    queryKey: adminKeys.analytics,
    queryFn: () => adminApi.getAnalytics(),
    enabled: role === "admin",
  });
}

export function useAdminDashboardConfig() {
  const { role } = useStore();
  return useQuery({
    queryKey: adminKeys.dashboardConfig,
    queryFn: () => adminApi.getDashboardConfig(),
    enabled: role === "admin",
  });
}

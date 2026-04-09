import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auth as authApi, oauth as oauthApi, history as historyApi, notificationsApi, adminApi } from "./api";
import { useStore } from "./store";
import { keys } from "./queries";
import type { CreateBookmarkData } from "./api";

// ── Auth ─────────────────────────────────────────────────────────────
export function useLogin() {
  const { setAuth, setGithubToken } = useStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: async (data) => {
      setAuth(data.access_token, data.user_id, data.email, data.role);
      // Restore github token status from server
      try {
        const me = await authApi.me();
        if (me.has_github_token) setGithubToken("stored");
      } catch {}
      qc.invalidateQueries({ queryKey: keys.me });
      toast.success("Signed in successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRegister() {
  const { setAuth } = useStore();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.register(email, password),
    onSuccess: (data) => setAuth(data.access_token, data.user_id, data.email, data.role),
  });
}

export function useRequestAccess() {
  return useMutation({
    mutationFn: ({ email, name, reason }: { email: string; name?: string; reason?: string }) =>
      authApi.requestAccess(email, name, reason),
    onSuccess: () => toast.success("Access request submitted"),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useClaim() {
  const { setAuth } = useStore();
  return useMutation({
    mutationFn: ({ token, password, email }: { token: string; password: string; email?: string }) =>
      authApi.claim(token, password, email),
    onSuccess: (data) => {
      setAuth(data.access_token, data.user_id, data.email, data.role);
      toast.success("Account activated successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetGithubToken() {
  const qc = useQueryClient();
  const { setGithubToken } = useStore();
  return useMutation({
    mutationFn: (token: string) => authApi.setGithubToken(token),
    onSuccess: () => {
      setGithubToken("stored"); // Don't store actual token in localStorage — just flag it
      qc.invalidateQueries({ queryKey: keys.me });
      toast.success("GitHub token saved to server");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── GitHub OAuth ─────────────────────────────────────────────────────
export function useGithubOAuthCallback() {
  const { setAuth, setGithubToken } = useStore();
  return useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      oauthApi.callback(code, state),
    onSuccess: (data) => {
      setAuth(data.access_token, data.user_id, data.email, "user");
      setGithubToken("oauth");
      toast.success("Signed in with GitHub");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Bookmarks ────────────────────────────────────────────────────────
export function useCreateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBookmarkData) => historyApi.createBookmark(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("Issue bookmarked");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: string; notes?: string }) =>
      historyApi.updateBookmark(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}

export function useDeleteBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => historyApi.deleteBookmark(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}

// ── Notifications ────────────────────────────────────────────────────
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useScanBookmarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.scanBookmarks(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ── Admin ────────────────────────────────────────────────────────────
export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.approveRequest(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-access-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`Access approved for ${data.email}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDenyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.denyRequest(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-access-requests"] });
      toast.success(`Access denied for ${data.email}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => adminApi.invite(email),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`Invitation sent to ${data.email}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; role?: string; is_active?: boolean }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDashboardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminApi.updateDashboardConfig>[0]) =>
      adminApi.updateDashboardConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dashboard-config"] });
      toast.success("Configuration updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

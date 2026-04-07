import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auth as authApi, oauth as oauthApi, history as historyApi, notificationsApi } from "./api";
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
      setAuth(data.access_token, data.user_id, data.email);
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
    onSuccess: (data) => setAuth(data.access_token, data.user_id, data.email),
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
      setAuth(data.access_token, data.user_id, data.email);
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

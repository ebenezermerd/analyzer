import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Repo } from "./api";

/**
 * Zustand store — UI-only state.
 * All server state (repos, issues, analysis, bookmarks, history) lives in TanStack Query.
 */
interface AppState {
  // Auth (persisted)
  token: string | null;
  userId: number | null;
  email: string | null;
  githubToken: string | null;
  setAuth: (token: string, userId: number, email: string) => void;
  setGithubToken: (token: string) => void;
  logout: () => void;

  // UI state
  selectedRepo: Repo | null;
  selectRepo: (repo: Repo | null) => void;

  // Preferences (persisted)
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      token: null,
      userId: null,
      email: null,
      githubToken: null,
      setAuth: (token, userId, email) => {
        if (typeof window !== "undefined") localStorage.setItem("token", token);
        set({ token, userId, email });
      },
      setGithubToken: (githubToken) => set({ githubToken }),
      logout: () => {
        if (typeof window !== "undefined") localStorage.removeItem("token");
        set({ token: null, userId: null, email: null, githubToken: null });
      },

      // UI
      selectedRepo: null,
      selectRepo: (repo) => set({ selectedRepo: repo }),

      // Preferences
      activeProfile: "pr_writer",
      setActiveProfile: (activeProfile) => set({ activeProfile }),
      language: "Python",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "issue-finder-storage",
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        email: state.email,
        githubToken: state.githubToken,
        activeProfile: state.activeProfile,
        language: state.language,
      }),
    }
  )
);

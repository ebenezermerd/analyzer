import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Repo } from "./api";

// ── Default preference values ────────────────────────────────
export const DEFAULTS = {
  minStars: 200,
  maxRepos: 30,
  maxIssues: 100,
  minScore: 5.0,
  concurrency: 10,
  maxReposAutoscan: 10,
  maxRepoSizeMb: 200,
  smartFilterDefault: true,
  minCodeFiles: 4,
  minLinesPerFile: 5,
  requireTests: false,
} as const;

interface Preferences {
  minStars: number;
  maxRepos: number;
  maxIssues: number;
  minScore: number;
  concurrency: number;
  maxReposAutoscan: number;
  maxRepoSizeMb: number;
  smartFilterDefault: boolean;
  minCodeFiles: number;
  minLinesPerFile: number;
  requireTests: boolean;
}

interface AppState extends Preferences {
  // Auth
  token: string | null;
  userId: number | null;
  email: string | null;
  githubToken: string | null;
  setAuth: (token: string, userId: number, email: string) => void;
  setGithubToken: (token: string) => void;
  logout: () => void;

  // UI
  selectedRepo: Repo | null;
  selectRepo: (repo: Repo | null) => void;

  // Profile + language
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  language: string;
  setLanguage: (lang: string) => void;

  // Preferences
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  resetPrefs: () => void;
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

      // Profile + language
      activeProfile: "pr_writer",
      setActiveProfile: (activeProfile) => set({ activeProfile }),
      language: "Python",
      setLanguage: (language) => set({ language }),

      // Preferences (with defaults)
      ...DEFAULTS,
      setPref: (key, value) => set({ [key]: value } as Partial<Preferences>),
      resetPrefs: () => set({ ...DEFAULTS }),
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
        minStars: state.minStars,
        maxRepos: state.maxRepos,
        maxIssues: state.maxIssues,
        minScore: state.minScore,
        concurrency: state.concurrency,
        maxReposAutoscan: state.maxReposAutoscan,
        maxRepoSizeMb: state.maxRepoSizeMb,
        smartFilterDefault: state.smartFilterDefault,
        minCodeFiles: state.minCodeFiles,
        minLinesPerFile: state.minLinesPerFile,
        requireTests: state.requireTests,
      }),
    }
  )
);

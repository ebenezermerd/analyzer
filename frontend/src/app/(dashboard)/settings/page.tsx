"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Key, Shield, Check, Loader2, LogOut, Compass, Target,
  Zap, RotateCcw, SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useStore, DEFAULTS } from "@/lib/store";
import { useSetGithubToken } from "@/lib/mutations";
import { useMe } from "@/lib/queries";
import { oauth } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const store = useStore();
  const { email, token, logout, setPref, resetPrefs } = store;
  const [ghToken, setGhToken] = useState("");
  const setTokenMutation = useSetGithubToken();
  const meQuery = useMe();
  const hasServerToken = meQuery.data?.has_github_token ?? false;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-light tracking-tight">
            <span className="gold-gradient">Settings</span>
          </h1>
          <p className="text-muted-foreground text-sm">Configure defaults, filters, and account.</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={resetPrefs}>
          <RotateCcw className="w-3 h-3" />Reset All Defaults
        </Button>
      </div>

      {/* ── Discovery Defaults ── */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />Discovery Defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <PrefInput label="Min Stars" value={store.minStars} onChange={(v) => setPref("minStars", v)} min={0} max={50000} step={50} hint="Minimum repo stargazers" />
            <PrefInput label="Max Repos" value={store.maxRepos} onChange={(v) => setPref("maxRepos", v)} min={1} max={100} hint="Max repos to discover" />
            <PrefInput label="Max Repo Size (MB)" value={store.maxRepoSizeMb} onChange={(v) => setPref("maxRepoSizeMb", v)} min={1} max={1000} hint="Skip repos larger than this" />
            <PrefInput label="Autoscan Max Repos" value={store.maxReposAutoscan} onChange={(v) => setPref("maxReposAutoscan", v)} min={1} max={50} hint="Repos to scan in autoscan" />
          </div>
        </CardContent>
      </Card>

      {/* ── Issue Analysis ── */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />Issue Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <PrefInput label="Min Score" value={store.minScore} onChange={(v) => setPref("minScore", v)} min={0} max={10} step={0.5} hint="Minimum passing score" />
            <PrefInput label="Min Code Files" value={store.minCodeFiles} onChange={(v) => setPref("minCodeFiles", v)} min={1} max={20} hint="Min code files changed in PR" />
            <PrefInput label="Min Lines Per File" value={store.minLinesPerFile} onChange={(v) => setPref("minLinesPerFile", v)} min={1} max={100} hint="Min lines changed per file" />
            <PrefToggle label="Smart Filter" value={store.smartFilterDefault} onChange={(v) => setPref("smartFilterDefault", v)} hint="Auto-filter issues by criteria" />
            <PrefToggle label="Require Tests" value={store.requireTests} onChange={(v) => setPref("requireTests", v)} hint="Require test files in PR changes" />
          </div>
        </CardContent>
      </Card>

      {/* ── Performance ── */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <PrefInput label="Max Issues Per Repo" value={store.maxIssues} onChange={(v) => setPref("maxIssues", v)} min={10} max={500} step={10} hint="Issues to fetch per repo" />
            <PrefInput label="Concurrency" value={store.concurrency} onChange={(v) => setPref("concurrency", v)} min={1} max={20} hint="Parallel API requests" />
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-4">
            Higher concurrency uses GitHub API quota faster. With a token: 5,000 req/hr. Without: 60 req/hr.
          </p>
        </CardContent>
      </Card>

      <Separator className="opacity-30" />

      {/* ── Account ── */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold border border-primary/20">
                  {(email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{email}</p>
                  <p className="text-xs text-muted-foreground">
                    GitHub token: {hasServerToken ? <Badge variant="secondary" className="text-[9px] text-green-400">configured on server</Badge> : <Badge variant="secondary" className="text-[9px] text-yellow-400">not set</Badge>}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => { logout(); router.push("/auth/login"); }}>
                <LogOut className="w-3 h-3 mr-1" /> Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Not signed in</p>
              <Button variant="outline" size="sm" className="text-xs text-primary border-primary/30" onClick={() => router.push("/auth/login")}>
                Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── GitHub Token ── */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />GitHub Personal Access Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            A GitHub token enables higher API rate limits. Create one at{" "}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              github.com/settings/tokens
            </a>{" "}
            with <code className="text-[10px] bg-muted px-1 py-0.5 rounded">repo</code> scope.
          </p>
          {hasServerToken && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <Check className="w-4 h-4 text-green-400" />
              <p className="text-xs text-green-400">GitHub token is saved on the server. API requests use your token for higher rate limits.</p>
            </div>
          )}
          <div className="flex gap-3">
            <Input placeholder={hasServerToken ? "Enter new token to replace..." : "ghp_xxxxxxxxxxxxxxxxxxxx"} type="password" className="glass font-mono text-xs" value={ghToken} onChange={(e) => setGhToken(e.target.value)} />
            <Button onClick={() => setTokenMutation.mutate(ghToken)} disabled={setTokenMutation.isPending || !ghToken || !token} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 shrink-0">
              {setTokenMutation.isSuccess ? <Check className="w-4 h-4 text-green-400" /> : setTokenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : hasServerToken ? "Update" : "Save"}
            </Button>
          </div>
          {!token && <p className="text-xs text-yellow-400">Sign in first to save your token to the server.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reusable setting inputs ──────────────────────────────────

function PrefInput({
  label, value, onChange, min, max, step = 1, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">{label}</label>
        <span className="text-[10px] text-muted-foreground font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[9px] text-muted-foreground/50">
        <span>{min}</span>
        <span className="italic">{hint}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function PrefToggle({
  label, value, onChange, hint,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">{label}</label>
        <button
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
            value ? "bg-primary" : "bg-muted"
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-[3px]"
          }`} />
        </button>
      </div>
      <p className="text-[9px] text-muted-foreground/50 italic">{hint}</p>
    </div>
  );
}

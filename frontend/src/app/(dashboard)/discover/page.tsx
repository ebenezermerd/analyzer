"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass, TrendingUp, Hash, BookOpen, Search, Star,
  HardDrive, ArrowRight, Loader2, Zap, Radio, CheckCircle2,
  XCircle, AlertCircle, SlidersHorizontal, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { useSearchRepos } from "@/lib/queries";
import { useWebSocket, type WSStatus } from "@/lib/use-websocket";
import type { Repo, AnalysisResult } from "@/lib/api";

const sourceConfig = {
  trending: { icon: TrendingUp, label: "Trending" },
  topics: { icon: Hash, label: "Topics" },
  curated: { icon: BookOpen, label: "Curated" },
};

export default function DiscoverPage() {
  const router = useRouter();
  const store = useStore();
  const { selectRepo, githubToken } = store;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("discover");
  const [triggerSearch, setTriggerSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Local filter overrides (initialized from store)
  const [fMinStars, setFMinStars] = useState(store.minStars);
  const [fMaxRepos, setFMaxRepos] = useState(store.maxRepos);
  const [fMaxSize, setFMaxSize] = useState(store.maxRepoSizeMb);

  const activeFilterCount = [
    fMinStars !== 200,
    fMaxRepos !== 30,
    fMaxSize !== 200,
  ].filter(Boolean).length;

  // ── WebSocket discovery ──────────────────────────────────
  const [discoverSource, setDiscoverSource] = useState("");
  const [discoverParams, setDiscoverParams] = useState<Record<string, string>>({});

  const discoverWS = useWebSocket<DiscoverEvent>(
    "/ws/discover",
    discoverParams,
  );

  const streamedRepos = useMemo(() => {
    return discoverWS.messages
      .filter((m): m is DiscoverRepoEvent => m.type === "repo")
      .map((m) => m.data);
  }, [discoverWS.messages]);

  const discoverDone = discoverWS.messages.find((m) => m.type === "done") as DiscoverDoneEvent | undefined;

  function handleDiscover(source: string) {
    setActiveTab("discover");
    setTriggerSearch("");
    setDiscoverSource(source);
    const sources = source === "all" ? "trending,topics,curated" : source;
    const params: Record<string, string> = {
      sources,
      max_repos: String(fMaxRepos),
    };
    if (githubToken) params.token = githubToken;
    setDiscoverParams(params);
    discoverWS.disconnect();
    setTimeout(() => {
      setDiscoverParams(params);
      discoverWS.connect();
    }, 50);
  }

  // ── HTTP search (no streaming needed) ────────────────────
  const searchQueryHook = useSearchRepos(triggerSearch, !!triggerSearch);

  function handleSearch() {
    if (!searchQuery.trim()) return;
    setActiveTab("search");
    setTriggerSearch(searchQuery.trim());
  }

  // ── WebSocket autoscan ───────────────────────────────────
  const [autoscanParams, setAutoscanParams] = useState<Record<string, string>>({});
  const autoscanWS = useWebSocket<AutoscanEvent>("/ws/autoscan", autoscanParams);

  const autoscanPhase = useMemo(() => {
    const msgs = autoscanWS.messages;
    const phase = msgs.findLast((m) => m.type === "phase") as AutoscanPhaseEvent | undefined;
    return phase;
  }, [autoscanWS.messages]);

  const autoscanRepoProgress = useMemo(() => {
    return autoscanWS.messages.filter(
      (m): m is AutoscanRepoDoneEvent => m.type === "repo_done"
    );
  }, [autoscanWS.messages]);

  const autoscanResults = useMemo(() => {
    const done = autoscanWS.messages.find(
      (m): m is AutoscanDoneEvent => m.type === "done"
    );
    return done?.results ?? [];
  }, [autoscanWS.messages]);

  function handleAutoscan() {
    setActiveTab("autoscan");
    const params: Record<string, string> = { max_repos: "10" };
    if (githubToken) params.token = githubToken;
    setAutoscanParams(params);
    autoscanWS.disconnect();
    setTimeout(() => {
      setAutoscanParams(params);
      autoscanWS.connect();
    }, 50);
  }

  // ── Select repo ──────────────────────────────────────────
  function handleSelectRepo(repo: Repo) {
    selectRepo(repo);
    router.push(`/repo?name=${encodeURIComponent(repo.full_name)}`);
  }

  // ── Current repos to show ────────────────────────────────
  const displayRepos = activeTab === "search"
    ? (searchQueryHook.data?.repos ?? [])
    : streamedRepos;

  const isDiscovering = discoverWS.status === "connecting" || discoverWS.status === "connected" || discoverWS.status === "streaming";
  const isSearching = searchQueryHook.isFetching;
  const isAutoScanning = autoscanWS.status === "connecting" || autoscanWS.status === "connected" || autoscanWS.status === "streaming";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-light tracking-tight">
          <span className="gold-gradient">Discover</span> Repositories
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Find repos with high-quality closed issues matching PR Writer criteria.
          Real-time streaming shows results as they arrive.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search repos... (e.g. web framework, task queue)"
            className="pl-10 glass h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          className="h-11 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:text-foreground glass"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[9px] px-1 py-0 ml-1">{activeFilterCount}</Badge>
          )}
        </button>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <FilterInput label="Min Stars" value={fMinStars} onChange={setFMinStars} min={0} max={50000} step={50} />
              <FilterInput label="Max Repos" value={fMaxRepos} onChange={setFMaxRepos} min={1} max={100} />
              <FilterInput label="Max Size MB" value={fMaxSize} onChange={setFMaxSize} min={1} max={1000} />
              <button
                onClick={() => { setFMinStars(200); setFMaxRepos(30); setFMaxSize(200); }}
                className="text-[10px] text-muted-foreground hover:text-primary whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3 inline mr-0.5" />Reset
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Source buttons + Tabs for content */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 glass rounded-lg p-1">
            {[
              { key: "all", label: "All Sources", icon: Zap },
              ...Object.entries(sourceConfig).map(([key, { icon, label }]) => ({ key, label, icon })),
              { key: "autoscan", label: "Autoscan", icon: Radio },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  if (key === "autoscan") {
                    setActiveTab("autoscan");
                    if (!isAutoScanning) handleAutoscan();
                  } else {
                    setActiveTab("discover");
                    handleDiscover(key);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  (key === "autoscan" ? activeTab === "autoscan" : activeTab === "discover" && discoverSource === key)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {displayRepos.length > 0 && activeTab !== "autoscan" && (
            <StreamStatus status={isDiscovering ? discoverWS.status : "done"} count={displayRepos.length} />
          )}
        </div>

        {/* ── Content ── */}
        <div className="mt-6">
          {activeTab === "autoscan" ? (
            <AutoscanView
              status={autoscanWS.status}
              phase={autoscanPhase}
              repoProgress={autoscanRepoProgress}
              results={autoscanResults}
              onSelectRepo={handleSelectRepo}
              onStart={handleAutoscan}
            />
          ) : activeTab === "search" ? (
            isSearching ? (
              <LoadingState message={`Searching "${triggerSearch}"...`} />
            ) : (searchQueryHook.data?.repos?.length ?? 0) === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-sm">
                {triggerSearch ? "No results found." : "Enter a search query above."}
              </div>
            ) : (
              <RepoGrid repos={searchQueryHook.data!.repos} onSelect={handleSelectRepo} />
            )
          ) : (
            isDiscovering && displayRepos.length === 0 ? (
              <LoadingState message="Discovering repositories..." />
            ) : displayRepos.length === 0 && discoverWS.status === "idle" ? (
              <EmptyState onDiscover={() => handleDiscover("all")} />
            ) : displayRepos.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-sm">No repositories found.</div>
            ) : (
              <RepoGrid repos={displayRepos} onSelect={handleSelectRepo} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

function StreamStatus({ status, count }: { status: WSStatus; count: number }) {
  if (status === "streaming" || status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-primary">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Streaming... {count} repos
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{count} repositories found</span>;
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ onDiscover }: { onDiscover: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center">
        <Compass className="w-10 h-10 text-primary/60" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl font-light">Start Exploring</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Discover trending Python repos, search by topic, or run Autoscan
          for a full pipeline discovery + analysis.
        </p>
      </div>
      <Button onClick={onDiscover} className="bg-primary text-primary-foreground hover:bg-primary/90">
        <Compass className="w-4 h-4 mr-2" />Discover Repos
      </Button>
    </div>
  );
}

function RepoGrid({ repos, onSelect }: { repos: Repo[]; onSelect: (r: Repo) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {repos.map((repo, i) => (
          <motion.div
            key={repo.full_name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.3 }}
          >
            <Card
              className="glass hover:bg-accent/50 transition-all duration-300 cursor-pointer group border-border/50 hover:border-primary/30"
              onClick={() => onSelect(repo)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {repo.full_name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {repo.description || "No description"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-2 shrink-0" />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" />{repo.stars.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{repo.size_mb} MB</span>
                  {repo.language && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{repo.language}</Badge>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Autoscan View ─────────────────────────────────────────────────

function AutoscanView({
  status, phase, repoProgress, results, onSelectRepo, onStart,
}: {
  status: WSStatus;
  phase: AutoscanPhaseEvent | undefined;
  repoProgress: AutoscanRepoDoneEvent[];
  results: AnalysisResult[];
  onSelectRepo: (r: Repo) => void;
  onStart: () => void;
}) {
  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center">
          <Radio className="w-10 h-10 text-primary/60" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-heading text-2xl font-light">Autoscan Pipeline</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            Automatically discover repos, scan all of them for matching issues,
            and surface the best results — all in one click.
          </p>
        </div>
        <Button onClick={onStart} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Zap className="w-4 h-4 mr-2" />Start Autoscan
        </Button>
      </div>
    );
  }

  const totalRepos = repoProgress.length > 0
    ? repoProgress[repoProgress.length - 1].total
    : phase?.repos ?? 0;

  const scannedCount = repoProgress.length;
  const progressPct = totalRepos > 0 ? (scannedCount / totalRepos) * 100 : 0;
  const totalHits = repoProgress.reduce((sum, r) => sum + r.hits, 0);

  const isRunning = status === "connecting" || status === "connected" || status === "streaming";
  const isDone = status === "done";

  return (
    <div className="space-y-6">
      {/* Phase indicator */}
      <div className="flex items-center gap-4">
        <PhaseStep label="Discover" active={phase?.phase === "discover"} done={phase?.phase !== "discover" && scannedCount > 0} />
        <div className="h-px flex-1 bg-border" />
        <PhaseStep label="Scan" active={phase?.phase === "scan" || scannedCount > 0} done={isDone} />
        <div className="h-px flex-1 bg-border" />
        <PhaseStep label="Results" active={isDone} done={isDone && results.length > 0} />
      </div>

      {/* Progress */}
      {isRunning && (
        <Card className="glass border-primary/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {phase?.phase === "discover" ? "Discovering repos..." : `Scanning repos...`}
              </span>
              <span className="text-primary font-mono text-xs">
                {scannedCount}/{totalRepos} repos · {totalHits} hits
              </span>
            </div>
            <Progress value={progressPct} className="h-1.5" />

            {/* Per-repo progress */}
            {repoProgress.length > 0 && (
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {repoProgress.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-mono w-12 shrink-0">[{r.index}/{r.total}]</span>
                      <span className="flex-1 truncate">{r.repo}</span>
                      {r.hits > 0 ? (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]">
                          {r.hits} hits
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50 text-[10px]">0</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {isDone && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl font-light">
              <span className="gold-gradient">{results.length}</span> Matching Issues Found
            </h3>
            {results.length === 0 && (
              <Button variant="outline" size="sm" onClick={onStart} className="text-xs">
                <Zap className="w-3 h-3 mr-1" />Re-run
              </Button>
            )}
          </div>

          {results.length === 0 ? (
            <Card className="glass border-border/30">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No passing issues found across {scannedCount} repos.</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting the profile or scanning more repos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {results.map((r, i) => (
                <motion.div
                  key={`${r.issue.number}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass border-border/30 hover:border-primary/20 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${r.passes ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                            {r.score.toFixed(1)}
                          </Badge>
                          <span className="text-xs text-primary font-mono">
                            #{r.issue.number}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">{r.complexity_hint}</Badge>
                        </div>
                        <p className="text-sm font-medium mt-1 truncate">{r.issue.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {r.issue.html_url.split("github.com/")[1]?.split("/issues")[0]}
                          {r.pr && ` · PR #${r.pr.number} · +${r.pr.total_additions}/-${r.pr.total_deletions}`}
                        </p>
                      </div>
                      <a href={r.issue.html_url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="text-xs shrink-0">
                          View
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhaseStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium ${
      done ? "text-green-400" : active ? "text-primary" : "text-muted-foreground/50"
    }`}>
      {done ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : active ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-current" />
      )}
      {label}
    </div>
  );
}

function FilterInput({
  label, value, onChange, min, max, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-16 h-7 px-2 text-xs font-mono rounded-md glass border border-border/30 focus:border-primary/40 focus:outline-none"
      />
    </div>
  );
}

// ── WebSocket Event Types ─────────────────────────────────────────

type DiscoverEvent = DiscoverStatusEvent | DiscoverRepoEvent | DiscoverDoneEvent | DiscoverErrorEvent;

interface DiscoverStatusEvent { type: "status"; message: string }
interface DiscoverRepoEvent { type: "repo"; index: number; total: number; data: Repo }
interface DiscoverDoneEvent { type: "done"; total: number }
interface DiscoverErrorEvent { type: "error"; message: string }

type AutoscanEvent = AutoscanPhaseEvent | AutoscanRepoDoneEvent | AutoscanDoneEvent | AutoscanErrorEvent;

interface AutoscanPhaseEvent { type: "phase"; phase: string; message?: string; repos?: number }
interface AutoscanRepoDoneEvent { type: "repo_done"; index: number; total: number; repo: string; hits: number; error?: string }
interface AutoscanDoneEvent { type: "done"; total_results: number; results: AnalysisResult[] }
interface AutoscanErrorEvent { type: "error"; message: string }

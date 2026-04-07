"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GitBranch, Star, HardDrive, ExternalLink, Filter,
  CheckCircle2, XCircle, HelpCircle, Loader2, ArrowUpRight,
  Bookmark as BookmarkIcon, FileCode, Download, ArrowLeft, ChevronRight,
  Copy, ChevronDown, Ban, Wrench, CheckCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { useRepo, useRepoIssues, useAnalyzeIssue, usePrDiff } from "@/lib/queries";
import { useCreateBookmark } from "@/lib/mutations";
import { DiffViewer } from "@/components/diff-viewer";
import { PrFileAnalysis } from "@/components/pr-file-analysis";
import { Pagination } from "@/components/pagination";
import { exportIssuesJSON, exportIssuesCSV } from "@/lib/export";
import { toast } from "sonner";
import type { Issue, AnalysisResult } from "@/lib/api";

const PAGE_SIZE = 20;

export default function RepoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
      <RepoPageInner />
    </Suspense>
  );
}

function RepoPageInner() {
  const searchParams = useSearchParams();
  const repoParam = searchParams.get("name");
  const { selectedRepo, selectRepo } = useStore();
  const [repoInput, setRepoInput] = useState("");
  const [smartFilter, setSmartFilter] = useState(true);
  const [selectedIssueNum, setSelectedIssueNum] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // Load repo from URL param if not already selected
  const repoQuery = useRepo(repoParam && !selectedRepo ? repoParam : null);
  useEffect(() => {
    if (repoQuery.data && !selectedRepo) {
      selectRepo(repoQuery.data);
    }
  }, [repoQuery.data]);

  const repo = selectedRepo;
  const issuesQuery = useRepoIssues(repo?.full_name ?? null, smartFilter, !!repo);
  const analysisQuery = useAnalyzeIssue(repo?.full_name ?? null, selectedIssueNum);
  const bookmarkMutation = useCreateBookmark();

  function handleDirectRepo() {
    if (!repoInput.includes("/")) return;
    selectRepo(null); // clear to trigger repoQuery
    const url = new URL(window.location.href);
    url.searchParams.set("name", repoInput);
    window.history.replaceState({}, "", url.toString());
    // Force reload
    window.location.reload();
  }

  function handleBookmark(result: AnalysisResult, status = "saved") {
    if (!repo) return;
    bookmarkMutation.mutate({
      repo: repo.full_name,
      issue_number: result.issue.number,
      issue_title: result.issue.title,
      issue_url: result.issue.html_url,
      score: result.score,
      status,
    });
  }

  if (!repo && !repoParam) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-light tracking-tight">
            <span className="gold-gradient">Explore</span> Repository
          </h1>
          <p className="text-muted-foreground text-sm">Select a repo from discovery or enter one directly.</p>
        </div>
        <div className="flex gap-3 max-w-lg">
          <Input
            placeholder="owner/repo (e.g. scrapy/scrapy)"
            className="glass"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDirectRepo()}
          />
          <Button onClick={handleDirectRepo} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">Go</Button>
        </div>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">Loading repository...</span>
      </div>
    );
  }

  const allIssues = issuesQuery.data?.issues ?? [];
  const totalIssues = issuesQuery.data?.total ?? 0;
  const filteredCount = issuesQuery.data?.filtered ?? 0;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allIssues.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const issues = allIssues.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2.5 text-xs"
      >
        <Link
          href="/discover"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-all duration-200 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="group-hover:text-primary">Discover</span>
        </Link>
        <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
        <span className="font-heading text-sm text-foreground/60 truncate max-w-[300px]">{repo.full_name}</span>
      </motion.div>

      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* Repo header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-light tracking-tight">
            <span className="gold-gradient">{repo.full_name}</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">{repo.description}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" />{repo.stars.toLocaleString()}</span>
            <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{repo.size_mb} MB</span>
            <Badge variant="secondary" className="text-[10px]">{repo.language}</Badge>
          </div>
        </div>
        <a href={repo.html_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline" size="sm"
          onClick={() => { setSmartFilter(true); setPage(1); }}
          className={smartFilter ? "border-primary/30 text-primary bg-primary/5" : ""}
        >
          <Filter className="w-3.5 h-3.5 mr-1.5" />Smart Filter
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => { setSmartFilter(false); setPage(1); }}
          className={!smartFilter ? "border-primary/30 text-primary bg-primary/5" : ""}
        >
          All Issues
        </Button>
        {smartFilter && totalIssues > 0 && (
          <span className="text-xs text-muted-foreground">
            {filteredCount} of {totalIssues} shown ({totalIssues - filteredCount} filtered)
          </span>
        )}
        {/* Spacer */}
        <div className="flex-1" />
        {/* Export */}
        {allIssues.length > 0 && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
              onClick={() => exportIssuesJSON(allIssues, repo.full_name)}>
              <Download className="w-3 h-3 mr-1" />JSON
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
              onClick={() => exportIssuesCSV(allIssues, repo.full_name)}>
              <Download className="w-3 h-3 mr-1" />CSV
            </Button>
          </div>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Issues list */}
        <div className="lg:col-span-3">
          {issuesQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Fetching & enriching issues...</span>
            </div>
          ) : issues.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No issues match the current criteria.
              <br />
              <button onClick={() => setSmartFilter(false)} className="text-primary underline mt-2">Show all unfiltered</button>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2 pr-4">
                  {issues.map((issue, i) => (
                    <IssueRow
                      key={issue.number}
                      issue={issue}
                      index={i}
                      isAnalyzing={analysisQuery.isFetching && selectedIssueNum === issue.number}
                      isSelected={selectedIssueNum === issue.number}
                      onSelect={() => setSelectedIssueNum(issue.number)}
                    />
                  ))}
                </div>
              </ScrollArea>
              <Pagination
                currentPage={safePage}
                totalItems={allIssues.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>

        {/* Analysis panel */}
        <div className="lg:col-span-2">
          {analysisQuery.data ? (
            <AnalysisPanel
              result={analysisQuery.data}
              repoFullName={repo.full_name}
              onBookmark={(status) => handleBookmark(analysisQuery.data!, status)}
              isBookmarking={bookmarkMutation.isPending}
              bookmarked={bookmarkMutation.isSuccess}
            />
          ) : analysisQuery.isFetching ? (
            <Card className="glass border-primary/20">
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">Analyzing #{selectedIssueNum}...</span>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass border-border/30">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <GitBranch className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Click an issue to analyze it</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueRow({
  issue, index, isAnalyzing, isSelected, onSelect,
}: {
  issue: Issue; index: number; isAnalyzing: boolean; isSelected: boolean; onSelect: () => void;
}) {
  const m = issue.metrics;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      <Card
        className={`glass cursor-pointer transition-all duration-200 hover:border-primary/30 ${
          isSelected ? "border-primary/40 bg-primary/5" : "border-border/30"
        }`}
        onClick={onSelect}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary font-mono">#{issue.number}</span>
                <RelevanceBadge score={issue.relevance} />
              </div>
              <p className="text-sm font-medium mt-1 line-clamp-2">{issue.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              <a href={issue.html_url} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/30 hover:text-primary transition-colors p-0.5">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <MetricIcon value={m.has_pr} trueLabel="PR" falseLabel="No PR" />
            <MetricIcon value={m.body_pure} trueLabel="Pure" falseLabel="Links" />
            {m.py_files !== null && (
              <span className={m.py_files >= 4 ? "text-green-400" : "text-muted-foreground"}>
                <FileCode className="w-3 h-3 inline mr-0.5" />{m.py_files}
              </span>
            )}
            {issue.labels.slice(0, 2).map((l) => (
              <Badge key={l} variant="secondary" className="text-[9px] px-1 py-0 h-4">{l}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MetricIcon({ value, trueLabel, falseLabel }: { value: boolean | null; trueLabel: string; falseLabel: string }) {
  if (value === true) return <span className="text-green-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{trueLabel}</span>;
  if (value === false) return <span className="text-red-400 flex items-center gap-0.5"><XCircle className="w-3 h-3" />{falseLabel}</span>;
  return <span className="text-muted-foreground flex items-center gap-0.5"><HelpCircle className="w-3 h-3" />?</span>;
}

function RelevanceBadge({ score }: { score: number }) {
  const color = score >= 8 ? "text-green-400 border-green-400/30 bg-green-400/10"
    : score >= 5 ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
    : "text-muted-foreground border-border bg-muted/30";
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>R{score.toFixed(0)}</span>;
}

function AnalysisPanel({
  result, repoFullName, onBookmark, isBookmarking, bookmarked,
}: {
  result: AnalysisResult; repoFullName: string; onBookmark: (status?: string) => void; isBookmarking: boolean; bookmarked: boolean;
}) {
  const passes = result.passes;
  const diffQuery = usePrDiff(result.pr ? repoFullName : null, result.pr?.number ?? null);
  const diffFiles = diffQuery.data?.files ?? [];

  function copySha() {
    if (result.pr?.base_sha) {
      navigator.clipboard.writeText(result.pr.base_sha);
      toast.success("Base SHA copied");
    }
  }

  const glowColor = passes
    ? "shadow-[0_0_30px_oklch(0.6_0.2_145/12%)]"
    : "shadow-[0_0_30px_oklch(0.6_0.2_25/12%)]";

  return (
    <div className="h-[calc(100vh-220px)] flex flex-col">
      {/* ─── VERDICT HEADER (fixed) ─── */}
      <div className={`shrink-0 glass rounded-t-lg p-4 ${passes ? "border border-green-500/20" : "border border-red-500/20"} ${glowColor}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-heading text-lg font-light">#{result.issue.number}</span>
          <Badge
            className={`text-xs px-2.5 py-0.5 font-mono ${
              passes
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            {passes ? "PASSES" : "FAILS"} — {result.score.toFixed(1)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{result.issue.title}</p>
        <Badge variant="secondary" className="text-[10px] mt-1.5">{result.complexity_hint}</Badge>
      </div>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollArea className="flex-1 min-h-0 border-x border-border/10">
        <div className="space-y-5 p-4">
          {/* Scoring breakdown */}
          <div className="glass rounded-lg p-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">Scoring Breakdown</p>
            {result.reasons.map((r, i) => {
              const isPositive = r.includes("pure text") || r.includes("code files changed") || r.includes("substantive") || r.includes("Recent") || r.includes("preferred label") || r.includes("substantial");
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-2 text-xs"
                >
                  {isPositive
                    ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                    : <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                  }
                  <span className="text-muted-foreground/80">{r}</span>
                </motion.div>
              );
            })}
          </div>

          {/* PR Summary */}
          {result.pr && (
            <div className="glass rounded-lg p-3 space-y-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Linked Pull Request</p>
              <div className="flex items-center justify-between">
                <a href={result.pr.html_url} target="_blank" rel="noreferrer"
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors">
                  PR #{result.pr.number} <ArrowUpRight className="w-3 h-3" />
                </a>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{result.pr.merged ? "merged" : result.pr.state}</Badge>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground/60">
                <span className="text-green-400/70">+{result.pr.total_additions}</span>
                <span className="text-red-400/70">-{result.pr.total_deletions}</span>
                <span>{result.pr.files_count} files</span>
              </div>
              {result.pr.base_sha && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-[10px] text-muted-foreground/40 truncate flex-1">base: {result.pr.base_sha}</p>
                  <button
                    onClick={copySha}
                    className="flex items-center gap-1 text-[9px] text-primary/70 hover:text-primary transition-colors shrink-0"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              )}
            </div>
          )}

          {/* File Analysis */}
          {result.pr && diffFiles.length > 0 && (
            <div className="glass rounded-lg p-3">
              <PrFileAnalysis
                files={diffFiles}
                totalAdditions={result.pr.total_additions}
                totalDeletions={result.pr.total_deletions}
              />
            </div>
          )}

          {/* Diff Viewer */}
          {result.pr && diffFiles.length > 0 && (
            <DiffViewer files={diffFiles} />
          )}
          {result.pr && diffQuery.isLoading && (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground/50">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading diff...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ─── ACTION BAR (fixed footer) ─── */}
      <div className="shrink-0 flex gap-2 p-3 rounded-b-lg border border-border/10 border-t-0 backdrop-blur-xl bg-background/60"
        style={{ borderTop: "1px solid oklch(0.8 0.12 75 / 10%)" }}>
        <a href={result.issue.html_url} target="_blank" rel="noreferrer" className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs hover:shadow-[0_0_12px_oklch(0.8_0.12_75/15%)] transition-shadow">
            <ExternalLink className="w-3 h-3 mr-1" /> Issue
          </Button>
        </a>
        {result.pr && (
          <a href={result.pr.html_url} target="_blank" rel="noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs hover:shadow-[0_0_12px_oklch(0.8_0.12_75/15%)] transition-shadow">
              <ExternalLink className="w-3 h-3 mr-1" /> PR
            </Button>
          </a>
        )}

        {/* Status dropdown */}
        {bookmarked ? (
          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs px-3 py-1.5 self-center">Saved</Badge>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger disabled={isBookmarking} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-200 border-primary/30 text-primary hover:shadow-[0_0_12px_oklch(0.8_0.12_75/15%)] ${isBookmarking ? "opacity-50" : ""}`}>
              {isBookmarking ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkIcon className="w-3 h-3" />}
              Save
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 glass">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onBookmark("saved")} className="text-xs gap-2">
                  <BookmarkIcon className="w-3.5 h-3.5 text-blue-400" /> Save to Bookmarks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBookmark("working")} className="text-xs gap-2">
                  <Wrench className="w-3.5 h-3.5 text-yellow-400" /> Mark as Working
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBookmark("blacklisted")} className="text-xs gap-2">
                  <Ban className="w-3.5 h-3.5 text-red-400" /> Blacklist Issue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBookmark("no_more")} className="text-xs gap-2">
                  <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" /> No More (Done)
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

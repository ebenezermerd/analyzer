"use client";

import { useMemo } from "react";
import { FileCode, TestTube, FileText, Settings2, File, Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { PrFileDiff } from "@/lib/api";

interface PrFileAnalysisProps {
  files: PrFileDiff[];
  totalAdditions: number;
  totalDeletions: number;
}

type FileType = "code" | "test" | "doc" | "config" | "other";

const TEST_PATTERNS = ["test_", "_test", "tests/", "/test/", "conftest", "spec.", "__tests__", ".test.", ".spec."];
const DOC_PATTERNS = ["readme", "changelog", "docs/", ".md", ".rst", ".txt", "license", "contributing"];
const CONFIG_PATTERNS = ["setup.cfg", "pyproject.toml", "package.json", "tsconfig", ".config.", "webpack", "vite.config", ".env", "Dockerfile", "Makefile", ".yml", ".yaml", ".toml"];

function classifyFile(filename: string): FileType {
  const fn = filename.toLowerCase();
  if (TEST_PATTERNS.some((p) => fn.includes(p))) return "test";
  if (DOC_PATTERNS.some((p) => fn.includes(p))) return "doc";
  if (CONFIG_PATTERNS.some((p) => fn.includes(p))) return "config";
  if (fn.endsWith(".py") || fn.endsWith(".js") || fn.endsWith(".ts") || fn.endsWith(".tsx") || fn.endsWith(".jsx") || fn.endsWith(".go") || fn.endsWith(".rs") || fn.endsWith(".java")) return "code";
  return "other";
}

function detectStatus(patch: string): "new" | "modified" | "deleted" | "renamed" {
  if (!patch) return "modified";
  // New file: all lines are additions, first hunk starts at line 1 with 0 old lines
  if (patch.startsWith("@@ -0,0 ")) return "new";
  if (patch.startsWith("@@ -1,") && !patch.includes("\n-")) return "new";
  // Deleted: all lines are deletions
  const lines = patch.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-"));
  if (lines.length > 0 && lines.every((l) => l.startsWith("-"))) return "deleted";
  return "modified";
}

const typeColors: Record<FileType, { bg: string; text: string; label: string }> = {
  code: { bg: "bg-green-500/20", text: "text-green-400", label: "Code" },
  test: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Test" },
  doc: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Doc" },
  config: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Config" },
  other: { bg: "bg-red-500/20", text: "text-red-400", label: "Other" },
};

const statusIcons = {
  new: { icon: Plus, color: "text-green-400", label: "New" },
  modified: { icon: Pencil, color: "text-yellow-400", label: "Modified" },
  deleted: { icon: Trash2, color: "text-red-400", label: "Deleted" },
  renamed: { icon: ArrowRight, color: "text-blue-400", label: "Renamed" },
};

export function PrFileAnalysis({ files, totalAdditions, totalDeletions }: PrFileAnalysisProps) {
  const analysis = useMemo(() => {
    const classified = files.map((f) => ({
      ...f,
      type: classifyFile(f.filename),
      status: detectStatus(f.patch),
    }));

    const byType: Record<FileType, typeof classified> = { code: [], test: [], doc: [], config: [], other: [] };
    for (const f of classified) byType[f.type].push(f);

    const newFiles = classified.filter((f) => f.status === "new").length;
    const modifiedFiles = classified.filter((f) => f.status === "modified").length;
    const deletedFiles = classified.filter((f) => f.status === "deleted").length;
    const hasTests = byType.test.length > 0;

    return { classified, byType, newFiles, modifiedFiles, deletedFiles, hasTests };
  }, [files]);

  const totalChanges = totalAdditions + totalDeletions;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat label="Files" value={files.length} />
        <MiniStat label="Added" value={`+${totalAdditions}`} color="text-green-400" />
        <MiniStat label="Removed" value={`-${totalDeletions}`} color="text-red-400" />
        <MiniStat label="Tests" value={analysis.hasTests ? `${analysis.byType.test.length} files` : "None"} color={analysis.hasTests ? "text-blue-400" : "text-muted-foreground/50"} />
      </div>

      {/* File type breakdown bar */}
      {totalChanges > 0 && (
        <TooltipProvider>
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Change Distribution</p>
          <div className="flex h-2 rounded-full overflow-hidden gap-px">
            {(["code", "test", "doc", "config", "other"] as FileType[]).map((type) => {
              const typeFiles = analysis.byType[type];
              const typeChanges = typeFiles.reduce((sum, f) => sum + f.additions + f.deletions, 0);
              const pct = (typeChanges / totalChanges) * 100;
              if (pct === 0) return null;
              const { bg } = typeColors[type];
              return (
                <Tooltip key={type}>
                  <TooltipTrigger>
                    <div className={`${bg} rounded-sm h-2`} style={{ width: `${Math.max(pct, 2)}%`, minWidth: "4px" }} />
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">
                    {typeColors[type].label}: {typeFiles.length} files, {typeChanges} changes ({pct.toFixed(0)}%)
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex gap-3 text-[9px] text-muted-foreground">
            {(["code", "test", "doc", "config", "other"] as FileType[]).map((type) => {
              const count = analysis.byType[type].length;
              if (count === 0) return null;
              return (
                <span key={type} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-sm ${typeColors[type].bg}`} />
                  {typeColors[type].label} ({count})
                </span>
              );
            })}
          </div>
        </div>
        </TooltipProvider>
      )}

      {/* Status summary */}
      <div className="flex gap-3 text-[10px]">
        {analysis.newFiles > 0 && (
          <span className="flex items-center gap-1 text-green-400"><Plus className="w-3 h-3" />{analysis.newFiles} new</span>
        )}
        {analysis.modifiedFiles > 0 && (
          <span className="flex items-center gap-1 text-yellow-400"><Pencil className="w-3 h-3" />{analysis.modifiedFiles} modified</span>
        )}
        {analysis.deletedFiles > 0 && (
          <span className="flex items-center gap-1 text-red-400"><Trash2 className="w-3 h-3" />{analysis.deletedFiles} deleted</span>
        )}
      </div>

      <Separator className="opacity-20" />

      {/* File matrix */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">File Changes ({analysis.classified.length})</p>
        {(() => {
          const fileRows = analysis.classified.map((f, i) => {
            const tc = typeColors[f.type];
            const sc = statusIcons[f.status];
            const StatusIcon = sc.icon;
            return (
              <div key={f.filename} className={`flex items-center gap-2 text-[11px] py-1.5 px-1 rounded-sm border-b border-border/5 last:border-0 transition-colors hover:bg-accent/20 ${i % 2 === 1 ? "bg-accent/5" : ""}`}>
                <Badge className={`${tc.bg} ${tc.text} text-[8px] px-1 py-0 w-10 justify-center border border-current/20`}>{tc.label}</Badge>
                <StatusIcon className={`w-3 h-3 ${sc.color} shrink-0`} />
                <span className="font-mono truncate flex-1 text-foreground/60">{f.filename}</span>
                <span className="text-green-400/70 font-mono text-[10px] shrink-0">+{f.additions}</span>
                <span className="text-red-400/70 font-mono text-[10px] shrink-0">-{f.deletions}</span>
              </div>
            );
          });

          // ≤10 files: show all, no scroll wrapper
          if (analysis.classified.length <= 10) {
            return <div className="space-y-0">{fileRows}</div>;
          }
          // >10 files: scroll with dynamic max height (30px per row approx)
          const maxH = Math.min(analysis.classified.length * 30, 400);
          return (
            <div className="overflow-y-auto" style={{ maxHeight: `${maxH}px` }}>
              <div className="space-y-0">{fileRows}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass rounded-md px-2.5 py-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      <p className={`text-sm font-mono font-medium ${color || ""}`}>{value}</p>
    </div>
  );
}

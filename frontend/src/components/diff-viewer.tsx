"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode, Plus, Minus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePrDiff } from "@/lib/queries";
import type { PrFileDiff } from "@/lib/api";

interface DiffViewerProps {
  repoFullName: string;
  prNumber: number;
}

export function DiffViewer({ repoFullName, prNumber }: DiffViewerProps) {
  const { data, isLoading } = usePrDiff(repoFullName, prNumber);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading diff...
      </div>
    );
  }

  const files = data?.files ?? [];
  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No diff available.</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        Files Changed ({files.length})
      </p>
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-1">
          {files.map((file) => (
            <DiffFile key={file.filename} file={file} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function DiffFile({ file }: { file: PrFileDiff }) {
  const [expanded, setExpanded] = useState(false);
  const lines = file.patch ? parsePatch(file.patch) : [];

  return (
    <div className="rounded-md border border-border/30 overflow-hidden">
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <FileCode className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="font-mono text-[11px] truncate flex-1 text-left">{file.filename}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[9px] px-1 py-0">
            +{file.additions}
          </Badge>
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-[9px] px-1 py-0">
            -{file.deletions}
          </Badge>
        </span>
      </button>

      {/* Diff content */}
      {expanded && lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono leading-5">
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={i}
                  className={
                    line.type === "add"
                      ? "bg-green-500/5"
                      : line.type === "del"
                      ? "bg-red-500/5"
                      : line.type === "hunk"
                      ? "bg-primary/5"
                      : ""
                  }
                >
                  <td className="w-5 px-1 text-right text-muted-foreground/40 select-none border-r border-border/20">
                    {line.type === "add" ? (
                      <Plus className="w-2.5 h-2.5 inline text-green-400" />
                    ) : line.type === "del" ? (
                      <Minus className="w-2.5 h-2.5 inline text-red-400" />
                    ) : null}
                  </td>
                  <td
                    className={`px-2 whitespace-pre ${
                      line.type === "add"
                        ? "text-green-300/80"
                        : line.type === "del"
                        ? "text-red-300/80"
                        : line.type === "hunk"
                        ? "text-primary/60 italic"
                        : "text-foreground/60"
                    }`}
                  >
                    {line.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && lines.length === 0 && (
        <p className="px-3 py-2 text-[10px] text-muted-foreground">Binary file or no patch data.</p>
      )}
    </div>
  );
}

interface DiffLine {
  type: "add" | "del" | "ctx" | "hunk";
  content: string;
}

function parsePatch(patch: string): DiffLine[] {
  return patch.split("\n").map((raw) => {
    if (raw.startsWith("@@")) return { type: "hunk" as const, content: raw };
    if (raw.startsWith("+")) return { type: "add" as const, content: raw.slice(1) };
    if (raw.startsWith("-")) return { type: "del" as const, content: raw.slice(1) };
    return { type: "ctx" as const, content: raw.startsWith(" ") ? raw.slice(1) : raw };
  });
}

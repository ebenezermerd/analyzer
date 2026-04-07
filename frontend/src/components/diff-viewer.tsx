"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, FileCode, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PrFileDiff } from "@/lib/api";

const TEST_PATTERNS = ["test_", "_test", "tests/", "/test/", "conftest", "spec.", "__tests__", ".test.", ".spec."];
const DOC_PATTERNS = ["readme", "changelog", "docs/", ".md", ".rst", ".txt", "license", "contributing"];

function classifyFile(filename: string): "code" | "test" | "doc" | "other" {
  const fn = filename.toLowerCase();
  if (TEST_PATTERNS.some((p) => fn.includes(p))) return "test";
  if (DOC_PATTERNS.some((p) => fn.includes(p))) return "doc";
  return "code";
}

function detectStatus(patch: string): "new" | "modified" | "deleted" {
  if (!patch) return "modified";
  if (patch.startsWith("@@ -0,0 ")) return "new";
  const lines = patch.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-"));
  if (lines.length > 0 && lines.every((l) => l.startsWith("-"))) return "deleted";
  return "modified";
}

const typeColors = {
  code: "bg-green-500/20 text-green-400 border-green-500/30",
  test: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  doc: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  other: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const statusLabels = {
  new: { label: "NEW", color: "text-green-400" },
  modified: { label: "MOD", color: "text-yellow-400" },
  deleted: { label: "DEL", color: "text-red-400" },
};

interface DiffViewerProps {
  files: PrFileDiff[];
}

export function DiffViewer({ files }: DiffViewerProps) {
  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No diff available.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-3">
        Code Changes ({files.length} files)
      </p>
      {files.map((file) => (
        <DiffFile key={file.filename} file={file} />
      ))}
    </div>
  );
}

function DiffFile({ file }: { file: PrFileDiff }) {
  const [expanded, setExpanded] = useState(false);
  const lines = file.patch ? parsePatch(file.patch) : [];
  const type = classifyFile(file.filename);
  const status = detectStatus(file.patch);
  const st = statusLabels[status];

  return (
    <div className="rounded-lg border border-border/20 overflow-hidden glass">
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs hover:bg-accent/30 transition-all duration-200 group"
      >
        <span className="text-muted-foreground/50 transition-transform duration-200 group-hover:text-muted-foreground">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <FileCode className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        <span className="font-mono text-[11px] truncate flex-1 text-left text-foreground/70 group-hover:text-foreground/90 transition-colors">
          {file.filename}
        </span>
        <Badge className={`text-[8px] px-1.5 py-0 border ${typeColors[type]}`}>{type}</Badge>
        <span className={`text-[9px] font-mono ${st.color}`}>{st.label}</span>
        <span className="flex items-center gap-1 shrink-0 ml-1">
          <span className="text-green-400/80 text-[10px] font-mono">+{file.additions}</span>
          <span className="text-red-400/80 text-[10px] font-mono">-{file.deletions}</span>
        </span>
      </button>

      {/* Diff content — animated expand */}
      <AnimatePresence>
        {expanded && lines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border/10"
          >
            <table className="w-full table-fixed text-[11px] font-mono leading-[1.6]">
              <tbody>
                {lines.map((line, i) => (
                  <tr
                    key={i}
                    className={
                      line.type === "add"
                        ? "bg-green-500/[0.06]"
                        : line.type === "del"
                        ? "bg-red-500/[0.06]"
                        : line.type === "hunk"
                        ? "bg-primary/[0.04]"
                        : ""
                    }
                  >
                    {/* Gutter */}
                    <td className="w-7 px-1.5 text-center select-none border-r border-border/10 shrink-0">
                      {line.type === "add" ? (
                        <Plus className="w-2.5 h-2.5 inline text-green-400/70" />
                      ) : line.type === "del" ? (
                        <Minus className="w-2.5 h-2.5 inline text-red-400/70" />
                      ) : null}
                    </td>
                    {/* Content */}
                    <td
                      className={`px-3 whitespace-pre-wrap break-all ${
                        line.type === "add"
                          ? "text-green-300/70 border-l-2 border-green-500/30"
                          : line.type === "del"
                          ? "text-red-300/70 border-l-2 border-red-500/30"
                          : line.type === "hunk"
                          ? "text-primary/40 italic font-heading text-xs border-l-2 border-primary/20"
                          : "text-foreground/40 border-l-2 border-transparent"
                      }`}
                    >
                      {line.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {expanded && lines.length === 0 && (
        <div className="px-4 py-3 text-[10px] text-muted-foreground/40 border-t border-border/10">
          Binary file or no patch data.
        </div>
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

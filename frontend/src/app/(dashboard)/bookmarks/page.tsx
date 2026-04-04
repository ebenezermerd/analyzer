"use client";

import { useState } from "react";
import { Bookmark, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/queries";
import { useUpdateBookmark, useDeleteBookmark } from "@/lib/mutations";

const statusColors: Record<string, string> = {
  saved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  working: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  done: "bg-green-500/10 text-green-400 border-green-500/30",
  skipped: "bg-muted text-muted-foreground border-border",
};

export default function BookmarksPage() {
  const [filter, setFilter] = useState<string | undefined>();
  const { data, isLoading } = useBookmarks(filter);
  const updateMutation = useUpdateBookmark();
  const deleteMutation = useDeleteBookmark();

  const bookmarks = data?.bookmarks ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-light tracking-tight">
          <span className="gold-gradient">Bookmarks</span>
        </h1>
        <p className="text-muted-foreground text-sm">Saved issues you want to work on.</p>
      </div>

      <div className="flex gap-2">
        {[undefined, "saved", "working", "done", "skipped"].map((s) => (
          <Button key={s || "all"} variant="outline" size="sm" onClick={() => setFilter(s)}
            className={filter === s ? "border-primary/30 text-primary bg-primary/5" : ""}>
            {s || "All"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : bookmarks.length === 0 ? (
        <Card className="glass border-border/30">
          <CardContent className="flex flex-col items-center py-16">
            <Bookmark className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No bookmarks yet. Save issues from the analysis view.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bookmarks.map((bm) => (
            <Card key={bm.id} className="glass border-border/30 hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-mono">{bm.repo}#{bm.issue_number}</span>
                    <Badge className={`text-[10px] ${statusColors[bm.status] || ""}`}>{bm.status}</Badge>
                    {bm.score > 0 && <span className="text-[10px] font-mono text-muted-foreground">score: {bm.score.toFixed(1)}</span>}
                  </div>
                  <p className="text-sm mt-1 truncate">{bm.issue_title}</p>
                  {bm.notes && <p className="text-xs text-muted-foreground mt-0.5">{bm.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {bm.status !== "working" && (
                    <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: bm.id, status: "working" })} className="text-xs h-7">Start</Button>
                  )}
                  {bm.status !== "done" && (
                    <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: bm.id, status: "done" })} className="text-xs h-7 text-green-400">Done</Button>
                  )}
                  <a href={bm.issue_url} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm" className="h-7"><ExternalLink className="w-3 h-3" /></Button>
                  </a>
                  <Button variant="ghost" size="sm" className="h-7 text-red-400" onClick={() => deleteMutation.mutate(bm.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

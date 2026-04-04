"use client";

import { Card, CardContent } from "@/components/ui/card";

export function RepoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass border-border/30">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted shimmer" />
              <div className="h-3 w-full rounded bg-muted/50 shimmer" />
            </div>
            <div className="flex gap-3">
              <div className="h-3 w-16 rounded bg-muted/30 shimmer" />
              <div className="h-3 w-12 rounded bg-muted/30 shimmer" />
              <div className="h-4 w-14 rounded bg-muted/30 shimmer" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function IssueListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass border-border/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-12 rounded bg-muted/40 shimmer" />
              <div className="h-4 w-8 rounded bg-muted/30 shimmer" />
            </div>
            <div className="h-4 w-3/4 rounded bg-muted shimmer" />
            <div className="flex gap-3">
              <div className="h-3 w-10 rounded bg-muted/30 shimmer" />
              <div className="h-3 w-10 rounded bg-muted/30 shimmer" />
              <div className="h-3 w-8 rounded bg-muted/30 shimmer" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="glass border-border/30">
      <CardContent className="p-5">
        <div className="h-3 w-20 rounded bg-muted/40 shimmer mb-2" />
        <div className="h-8 w-16 rounded bg-muted/30 shimmer" />
      </CardContent>
    </Card>
  );
}

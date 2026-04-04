"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History as HistoryIcon, Search, Compass, Zap, Loader2,
  ChevronDown, ChevronRight, ExternalLink, BarChart3,
  TrendingUp, Target, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useScanHistory, useAnalytics, useScanResults } from "@/lib/queries";
import { ActivityChart, ScanTypeChart, TopReposChart } from "@/components/charts";

const typeIcons: Record<string, typeof Search> = {
  search: Search, discover: Compass, scan: Zap, autoscan: Zap,
};

export default function HistoryPage() {
  const { data: historyData, isLoading } = useScanHistory();
  const { data: analytics } = useAnalytics();
  const [expandedScan, setExpandedScan] = useState<number | null>(null);

  const scans = historyData?.scans ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-light tracking-tight">
          <span className="gold-gradient">History</span> & Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Scan history, performance metrics, and discovery trends.</p>
      </div>

      {/* ── Stats Row ── */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={BarChart3} label="Total Scans" value={analytics.total_scans} />
          <StatCard icon={Target} label="Issues Found" value={analytics.total_issues_found} />
          <StatCard icon={TrendingUp} label="Scan Types" value={Object.keys(analytics.scans_by_type).length} />
          <StatCard icon={Clock} label="Recent" value={analytics.recent_scans.length} />
        </div>
      )}

      {/* ── Charts ── */}
      {analytics && (analytics.daily_activity?.length > 0 || Object.keys(analytics.scans_by_type).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Activity over time */}
          {analytics.daily_activity?.length > 0 && (
            <Card className="glass border-border/30 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Activity (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityChart data={analytics.daily_activity} />
              </CardContent>
            </Card>
          )}

          {/* Scan type distribution */}
          {Object.keys(analytics.scans_by_type).length > 0 && (
            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Scan Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ScanTypeChart data={analytics.scans_by_type} />
              </CardContent>
            </Card>
          )}

          {/* Top repos */}
          {analytics.top_repos?.length > 0 && (
            <Card className="glass border-border/30 lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Repos by Passing Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <TopReposChart data={analytics.top_repos} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator className="opacity-30" />

      {/* ── Scan History ── */}
      <div className="space-y-2">
        <h3 className="font-heading text-lg font-light text-muted-foreground">Scan History</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : scans.length === 0 ? (
          <Card className="glass border-border/30">
            <CardContent className="flex flex-col items-center py-16">
              <HistoryIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No scan history yet. Start discovering!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => (
              <ScanRow
                key={scan.id}
                scan={scan}
                isExpanded={expandedScan === scan.id}
                onToggle={() => setExpandedScan(expandedScan === scan.id ? null : scan.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Search; label: string; value: number }) {
  return (
    <Card className="glass border-border/30">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="font-heading text-2xl font-light gold-gradient">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanRow({
  scan, isExpanded, onToggle,
}: {
  scan: { id: number; scan_type: string; query: string | null; repos_scanned: number; issues_found: number; issues_passed: number; duration_sec: number; created_at: string };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = typeIcons[scan.scan_type] || HistoryIcon;

  return (
    <div>
      <Card
        className="glass border-border/30 hover:border-primary/20 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{scan.scan_type}</Badge>
              {scan.query && <span className="text-sm truncate">{scan.query}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scan.repos_scanned} repos · {scan.issues_passed} passed · {scan.duration_sec.toFixed(1)}s
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(scan.created_at).toLocaleDateString()}
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </CardContent>
      </Card>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ScanResultsExpanded scanId={scan.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScanResultsExpanded({ scanId }: { scanId: number }) {
  const { data, isLoading } = useScanResults(scanId);
  const results = data?.results ?? [];

  if (isLoading) {
    return (
      <div className="py-4 pl-16 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading results...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-3 pl-16 text-xs text-muted-foreground">No results stored for this scan.</div>
    );
  }

  return (
    <div className="pl-16 pr-4 py-2 space-y-1">
      {results.map((r, i) => (
        <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/20 last:border-0">
          <Badge className={`text-[10px] shrink-0 ${r.passes ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            {r.score.toFixed(1)}
          </Badge>
          <span className="text-primary font-mono shrink-0">#{r.issue_number}</span>
          <span className="truncate flex-1">{r.issue_title}</span>
          {r.complexity_hint && <Badge variant="secondary" className="text-[9px] shrink-0">{r.complexity_hint}</Badge>}
          {r.issue_url && (
            <a href={r.issue_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

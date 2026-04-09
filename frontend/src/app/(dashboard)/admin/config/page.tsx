"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal, Save, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminDashboardConfig } from "@/lib/queries";
import { useUpdateDashboardConfig } from "@/lib/mutations";

export default function AdminConfigPage() {
  const { data, isLoading } = useAdminDashboardConfig();
  const updateMutation = useUpdateDashboardConfig();

  const [minStars, setMinStars] = useState(0);
  const [maxRepos, setMaxRepos] = useState(0);
  const [maxIssues, setMaxIssues] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [concurrency, setConcurrency] = useState(0);

  useEffect(() => {
    if (data) {
      setMinStars(data.default_min_stars);
      setMaxRepos(data.default_max_repos);
      setMaxIssues(data.default_max_issues);
      setMinScore(data.default_min_score);
      setConcurrency(data.default_concurrency);
    }
  }, [data]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      default_min_stars: minStars,
      default_max_repos: maxRepos,
      default_max_issues: maxIssues,
      default_min_score: minScore,
      default_concurrency: concurrency,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          Dashboard Configuration
        </h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const fields = [
    { label: "Default Min Stars", desc: "Minimum stars for repo discovery", value: minStars, set: setMinStars, type: "number" },
    { label: "Default Max Repos", desc: "Maximum repos per discovery request", value: maxRepos, set: setMaxRepos, type: "number" },
    { label: "Default Max Issues", desc: "Maximum issues to analyze per repo", value: maxIssues, set: setMaxIssues, type: "number" },
    { label: "Default Min Score", desc: "Minimum score threshold for issues", value: minScore, set: setMinScore, type: "number", step: "0.5" },
    { label: "Default Concurrency", desc: "Parallel analysis tasks", value: concurrency, set: setConcurrency, type: "number" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          Dashboard Configuration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-wide default settings for all users
        </p>
      </div>

      <Card className="glass border-border/30">
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-5">
              {fields.map(({ label, desc, value, set, step }) => (
                <div key={label} className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    step={step}
                    className="glass"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Configuration
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

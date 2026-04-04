"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, Shield, Check, Loader2, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { useSetGithubToken } from "@/lib/mutations";

export default function SettingsPage() {
  const router = useRouter();
  const { email, token, githubToken, logout } = useStore();
  const [ghToken, setGhToken] = useState(githubToken || "");
  const setTokenMutation = useSetGithubToken();

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-light tracking-tight">
          <span className="gold-gradient">Settings</span>
        </h1>
        <p className="text-muted-foreground text-sm">Account and GitHub configuration.</p>
      </div>

      {/* Account */}
      <Card className="glass border-border/30">
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {token ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold border border-primary/20">
                  {(email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{email}</p>
                  <p className="text-xs text-muted-foreground">
                    GitHub token: {githubToken ? <Badge variant="secondary" className="text-[9px]">configured</Badge> : <Badge variant="secondary" className="text-[9px] text-yellow-400">not set</Badge>}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => { logout(); router.push("/auth/login"); }}
              >
                <LogOut className="w-3 h-3 mr-1" /> Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Not signed in</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-primary border-primary/30"
                onClick={() => router.push("/auth/login")}
              >
                Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="opacity-30" />

      {/* GitHub Token */}
      <Card className="glass border-border/30">
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            GitHub Personal Access Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            A GitHub token enables higher API rate limits (5,000 requests/hour vs 60 without).
            Create one at{" "}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              github.com/settings/tokens
            </a>{" "}
            with <code className="text-[10px] bg-muted px-1 py-0.5 rounded">repo</code> scope.
          </p>
          <div className="flex gap-3">
            <Input
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              type="password"
              className="glass font-mono text-xs"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
            />
            <Button
              onClick={() => setTokenMutation.mutate(ghToken)}
              disabled={setTokenMutation.isPending || !ghToken || !token}
              className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 shrink-0"
            >
              {setTokenMutation.isSuccess ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : setTokenMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
          {!token && (
            <p className="text-xs text-yellow-400">
              Sign in first to save your token to the server.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, GitBranch, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { useLogin, useRegister } from "@/lib/mutations";
import { oauth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { token } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState("");

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const authMutation = isRegister ? registerMutation : loginMutation;

  // Redirect if already authenticated
  useEffect(() => {
    if (token) router.push("/discover");
  }, [token, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    authMutation.mutate({ email, password });
  }

  async function handleGithubOAuth() {
    setOauthLoading(true);
    setOauthError("");
    try {
      const { url } = await oauth.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "GitHub OAuth not available");
      setOauthLoading(false);
    }
  }

  if (token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/3 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-light tracking-tight">
            <span className="gold-gradient">Issue Finder</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover perfect GitHub issues for PR Writer
          </p>
        </div>

        <Card className="glass-strong border-border/30">
          <CardContent className="p-8 space-y-6">
            {/* GitHub OAuth */}
            <Button
              variant="outline"
              className="w-full h-12 gap-2.5 glass border-border/50 hover:border-primary/30 text-sm font-medium"
              onClick={handleGithubOAuth}
              disabled={oauthLoading}
            >
              {oauthLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GitBranch className="w-4 h-4" />
              )}
              Sign in with GitHub
            </Button>

            {oauthError && (
              <p className="text-xs text-muted-foreground text-center">
                {oauthError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Separator className="flex-1 opacity-20" />
              <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">or</span>
              <Separator className="flex-1 opacity-20" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Input
                  placeholder="Email address"
                  type="email"
                  className="glass h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Input
                  placeholder="Password"
                  type="password"
                  className="glass h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </div>

              {authMutation.isError && (
                <p className="text-xs text-red-400">
                  {(authMutation.error as Error).message}
                </p>
              )}

              <Button
                type="submit"
                disabled={authMutation.isPending || !email || !password}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {authMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {isRegister ? "Create Account" : "Sign In"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-primary hover:underline"
              >
                {isRegister ? "Sign in" : "Create one"}
              </button>
            </p>
          </CardContent>
        </Card>

        {/* Skip auth */}
        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          <button
            onClick={() => router.push("/discover")}
            className="hover:text-muted-foreground transition-colors"
          >
            Continue without signing in →
          </button>
        </p>
      </motion.div>
    </div>
  );
}

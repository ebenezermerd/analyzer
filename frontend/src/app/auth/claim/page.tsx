"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Loader2, AlertCircle, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/api";
import { useClaim } from "@/lib/mutations";

function ClaimInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const claimMutation = useClaim();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No claim token provided");
      setValidating(false);
      return;
    }
    auth.validateClaim(token)
      .then((data) => {
        setValid(true);
        setPrefillEmail(data.email);
        setEmail(data.email);
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired claim token");
      })
      .finally(() => setValidating(false));
  }, [token]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) return;
    if (password.length < 8) return;
    claimMutation.mutate(
      { token, password, email: email !== prefillEmail ? email : undefined },
      { onSuccess: () => router.push("/discover") }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-light tracking-tight">
            <span className="gold-gradient">Claim Account</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up your password to activate your account
          </p>
        </div>

        <Card className="glass-strong border-border/30">
          <CardContent className="p-8 space-y-6">
            {validating ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-3">Validating your claim link...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-red-400">{error}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This link may have expired or already been used.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="glass border-border/50"
                  onClick={() => router.push("/auth/login")}
                >
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                  <KeyRound className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Set your credentials to activate your account
                  </p>
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="Email address"
                    type="email"
                    className="glass h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="New password (min 8 characters)"
                    type="password"
                    className="glass h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <Input
                    placeholder="Confirm password"
                    type="password"
                    className="glass h-11"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}

                {claimMutation.isError && (
                  <p className="text-xs text-red-400">
                    {(claimMutation.error as Error).message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={
                    claimMutation.isPending ||
                    !password ||
                    password.length < 8 ||
                    password !== confirmPassword
                  }
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  {claimMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Activate Account"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <ClaimInner />
    </Suspense>
  );
}

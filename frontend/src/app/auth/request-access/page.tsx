"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRequestAccess } from "@/lib/mutations";

export default function RequestAccessPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const requestMutation = useRequestAccess();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    requestMutation.mutate({ email, name: name || undefined, reason: reason || undefined });
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
            <span className="gold-gradient">Request Access</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit a request to join Issue Finder
          </p>
        </div>

        <Card className="glass-strong border-border/30">
          <CardContent className="p-8 space-y-6">
            {requestMutation.isSuccess ? (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium">Request Submitted</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You will receive an email when your request is approved.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="glass border-border/50"
                  onClick={() => router.push("/auth/login")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Input
                    placeholder="Email address *"
                    type="email"
                    className="glass h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    placeholder="Your name (optional)"
                    type="text"
                    className="glass h-11"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Why do you want access? (optional)"
                    className="glass min-h-[80px] resize-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                {requestMutation.isError && (
                  <p className="text-xs text-red-400">
                    {(requestMutation.error as Error).message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={requestMutation.isPending || !email}
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  {requestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </form>
            )}

            {!requestMutation.isSuccess && (
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => router.push("/auth/login")}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

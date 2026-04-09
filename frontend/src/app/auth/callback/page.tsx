"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useGithubOAuthCallback } from "@/lib/mutations";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mutation = useGithubOAuthCallback();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state && !mutation.isPending && !mutation.isSuccess && !mutation.isError) {
      mutation.mutate({ code, state });
    }
  }, [searchParams]);

  useEffect(() => {
    if (mutation.isSuccess) {
      const timer = setTimeout(() => router.push("/discover"), 1500);
      return () => clearTimeout(timer);
    }
  }, [mutation.isSuccess, router]);

  return (
    <div className="min-h-screen flex items-center justify-center noise">
      <div className="text-center space-y-4">
        {mutation.isPending && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Signing in with GitHub...</p>
          </>
        )}
        {mutation.isSuccess && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
            <p className="text-foreground">Signed in successfully!</p>
            <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
          </>
        )}
        {mutation.isError && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-foreground">Authentication failed</p>
            <p className="text-xs text-red-400">{(mutation.error as Error).message}</p>
            <div className="flex gap-3 justify-center mt-2">
              <button onClick={() => router.push("/auth/request-access")} className="text-xs text-primary underline">
                Request Access
              </button>
              <button onClick={() => router.push("/auth/login")} className="text-xs text-muted-foreground underline">
                Back to login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <CallbackInner />
    </Suspense>
  );
}

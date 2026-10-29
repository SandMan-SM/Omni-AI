"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { CpsMarketingClient } from "./CpsMarketingClient";

export function CpsMarketingAccess() {
  const { user, loading } = useAuth();
  // The effect only needs to know WHETHER there is a signed-in operator, and
  // it must not re-run every time `useAuth` hands back a fresh object for the
  // same session. The user's id is the stable primitive for that: it flips
  // exactly when the session changes, and depending on the id keeps the
  // effect's dependency list honest instead of silencing the lint rule.
  const userId = user?.id ?? null;
  const [report, setReport] = useState<ComponentProps<typeof CpsMarketingClient> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError("");
    if (loading) return () => controller.abort();
    // Do not ask for the report before there is a session to ask with. The
    // endpoint answers 401 to an anonymous caller, and an unauthorised
    // request that is guaranteed to fail is noise in the network log, in
    // the browser console, and in the live audit gate.
    if (!userId) return () => controller.abort();
    authFetch("/api/dashboard/cps-marketing", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Report temporarily unavailable.");
        if (!controller.signal.aborted) setReport(data);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || "Report temporarily unavailable."); });
    return () => controller.abort();
  }, [userId, loading, attempt]);

  if (report) return <CpsMarketingClient {...report} />;

  const signedOut = !loading && !user;
  const message = signedOut
    ? "This report is for authorized CPS operators. Sign in to view it."
    : error || "Checking access…";

  return <main className="min-h-screen px-6 py-32 text-white flex items-center justify-center">
    <div className="max-w-lg text-center space-y-6">
      <p className="text-sm text-purple-300">CPS · Private operator report</p>
      <h1 className="text-3xl font-bold">CPS marketing</h1>
      <p role="status">{message}</p>
      {(signedOut || error) && <div className="flex flex-wrap justify-center gap-4">
        <Link href="/login?next=/cps/marketing" className="rounded-lg bg-purple-600 px-5 py-3 min-h-11 inline-flex items-center">Sign in</Link>
        {error && !signedOut && <button type="button" className="rounded-lg border border-white/30 px-5 py-3 min-h-11 inline-flex items-center" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
      </div>}
    </div>
  </main>;
}

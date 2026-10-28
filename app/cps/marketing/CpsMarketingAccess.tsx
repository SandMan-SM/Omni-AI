"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { CpsMarketingClient } from "./CpsMarketingClient";

export function CpsMarketingAccess() {
  const { user, loading } = useAuth();
  const [report, setReport] = useState<ComponentProps<typeof CpsMarketingClient> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError("");
    if (loading) return () => controller.abort();
    authFetch("/api/dashboard/cps-marketing", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Report temporarily unavailable.");
        if (!controller.signal.aborted) setReport(data);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || "Report temporarily unavailable."); });
    return () => controller.abort();
  }, [user?.id, loading, attempt]);
  if (report) return <CpsMarketingClient {...report} />;
  return <main className="min-h-screen px-6 py-32 text-white flex items-center justify-center">
    <div className="max-w-lg text-center space-y-6">
      <p className="text-sm text-purple-300">CPS · Private operator report</p>
      <h1 className="text-3xl font-bold">CPS marketing</h1>
      <p role="status">{error || "Checking access…"}</p>
      {error && <div className="flex flex-wrap justify-center gap-4">
        <Link href="/login?next=/cps/marketing" className="rounded-lg bg-purple-600 px-5 py-3">Sign in</Link>
        <button type="button" className="rounded-lg border border-white/30 px-5 py-3" onClick={() => setAttempt(value => value + 1)}>Try again</button>
      </div>}
    </div>
  </main>;
}

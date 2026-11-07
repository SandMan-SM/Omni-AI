"use client";

// Mafi operator view — the Omni OS control plane: every client agent's
// operating state, its score, its gaps, and the ranked action queue.
//
// WHY THIS IS A CLIENT COMPONENT
//
// The control-plane read used to happen here, in a server component, and
// the middleware has no protected routes — so the DOCUMENT request
// carried no credential and `GET /dashboard/omni-os` answered 200 with
// the whole portfolio to anyone with the URL. The same defect, fixed the
// same way on 2026-11-04, moved `/dashboard/council` and
// `/dashboard/federation` behind `requireAdmin()`; this page was missed
// because it is the only internal page in this namespace that was still
// a server component, and the gate that looks for it did not exist.
//
// The read now lives in `/api/omni-os/snapshot` behind `requireAdmin()`,
// and this page fetches it with the `omni_token` bearer — the same idiom
// `/api/dashboard/metrics`, `/api/dashboard/council` and the Command
// Center tab already use. Metadata moved to the sibling `layout.tsx` (a
// client component cannot export `metadata`).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, Gauge, Loader2, LockKeyhole, ShieldCheck, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { PT_TZ } from "@/lib/tz";
import type {
  OmniOSAutonomy,
  OmniOSLoopKey,
  OmniOSOperatorSnapshot,
} from "@/lib/omni-os/types";

const loopLabels: Record<OmniOSLoopKey, string> = {
  leads: "Leads/CRM",
  analytics: "Analytics",
  website: "Website/CTA",
  seoGeo: "SEO/GEO",
  contentSocial: "Content/Social",
  automation: "Automation",
  dashboard: "Dashboard",
  verifiedVelocity: "Receipts",
};

const autonomyLabels: Record<OmniOSAutonomy, string> = {
  auto_execute: "Auto-execute lane",
  needs_approval: "Needs $Mafi approval",
  blocked_needs_data: "Blocked: needs data",
};

function scoreTone(score: number) {
  if (score >= 90) return "border-emerald-300/35 bg-emerald-300/[0.08] text-emerald-100";
  if (score >= 75) return "border-sky-300/35 bg-sky-300/[0.08] text-sky-100";
  if (score >= 50) return "border-amber-300/35 bg-amber-300/[0.08] text-amber-100";
  return "border-rose-300/35 bg-rose-300/[0.08] text-rose-100";
}

export default function OmniOSPage() {
  const [snapshot, setSnapshot] = useState<OmniOSOperatorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch("/api/omni-os/snapshot", { cache: "no-store", headers })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: OmniOSOperatorSnapshot) => setSnapshot(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#050506] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="min-h-screen bg-[#050506] px-4 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-6 py-5">
            <p className="font-semibold text-rose-200">Control plane unavailable</p>
            <p className="mt-2 text-sm text-rose-200/80">{error}</p>
            <p className="mt-4 text-xs text-zinc-500">
              This view is admin-only. Sign in with an admin account to see the
              Omni OS control plane.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const topActions = snapshot.actionQueue.slice(0, 10);

  const metricCards: Array<[string, number, LucideIcon]> = [
    ["Businesses", snapshot.summary.businessesTotal, Bot],
    ["Operational", snapshot.summary.operationalCount, ShieldCheck],
    ["Strong layer", snapshot.summary.strongOperatorCount, Gauge],
    ["Need data", snapshot.summary.blockedNeedsDataCount, CircleAlert],
    ["Auto actions", snapshot.summary.autoExecutableActions, Zap],
  ];

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.20),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-2xl shadow-black/40 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                <Sparkles className="h-3.5 w-3.5" />
                Omni OS
              </div>
              <h1 className="mt-5 font-serif text-4xl leading-tight text-white sm:text-6xl">
                The AI CEO control plane.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                One operating layer for every business: perceive the signal, rank the move, execute the safe fix, hold approvals at the boundary, verify the result, and remember what worked.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Generated</p>
              <p className="mt-1 font-mono text-zinc-100">{new Date(snapshot.generatedAt).toLocaleString('en-US', { timeZone: PT_TZ })}</p>
              <Link href="/dashboard/agents" className="mt-4 inline-flex items-center gap-2 text-amber-100 hover:text-amber-50">
                Agent fleet <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metricCards.map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label as string}</p>
                <Icon className="h-5 w-5 text-amber-100" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{String(value)}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/70">Client CEOs</p>
                <h2 className="mt-2 text-2xl font-semibold">Business operating states</h2>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {snapshot.businesses.map((business) => (
                <article key={business.slug} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{business.tier.replaceAll('_', ' ')}</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{business.businessName}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{business.agentName}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 text-center ${scoreTone(business.score)}`}>
                      <p className="text-2xl font-bold">{business.score}</p>
                      <p className="text-[10px] uppercase tracking-[0.16em] opacity-75">score</p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-300">{business.statusLabel}</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-400">{business.primaryGoal}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {business.missingLoops.slice(0, 5).map((loop) => (
                      <span key={loop} className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 text-xs text-amber-100">
                        {loopLabels[loop]}
                      </span>
                    ))}
                    {business.missingLoops.length === 0 && (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1 text-xs text-emerald-100">All core loops connected</span>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Next move</p>
                    <p className="mt-2 font-semibold text-white">{business.primaryAction.title}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{business.primaryAction.whyItMatters}</p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      {business.primaryAction.autonomy === 'needs_approval' ? <LockKeyhole className="h-3.5 w-3.5 text-amber-100" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-100" />}
                      {autonomyLabels[business.primaryAction.autonomy]}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/70">Ranked queue</p>
              <h2 className="mt-2 text-2xl font-semibold">What OmniClaw should do next</h2>
              <div className="mt-5 space-y-3">
                {topActions.map((action, index) => (
                  <div key={action.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">#{index + 1} · {action.businessSlug}</p>
                      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">{action.expectedImpact}</span>
                    </div>
                    <p className="mt-2 font-semibold text-white">{action.title}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{action.verification}</p>
                    <p className="mt-3 text-xs text-amber-100/80">{autonomyLabels[action.autonomy]}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/70">Boundary</p>
              <h2 className="mt-2 text-xl font-semibold">What still needs $Mafi</h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-300">
                <li>Client-facing sends or legal/medical claims.</li>
                <li>Money movement, refunds, ad spend, subscriptions.</li>
                <li>Secret rotation/disclosure or destructive production data operations.</li>
                <li>Supabase migrations until explicitly approved.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Crown,
  ExternalLink,
  Loader2,
  Mail,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Cross-brand Command Center — admin meta-dashboard.
 *
 * Aggregates KPIs across every active client workspace into a single
 * page. Pulls /api/dashboard/command-center which is admin-gated; the
 * page itself fails closed (the API returns 403 for non-admins, the UI
 * renders the 403 message instead of the rollup).
 */
type ClientRollup = {
  slug: string;
  label: string;
  leads_7d: number;
  leads_28d: number;
  page_views_7d: number;
  page_views_28d: number;
  newsletter_opens_7d: number;
  active_sessions_30min: number;
  last_lead_at: string | null;
};
type Steward = {
  domain: string;
  steward_name: string | null;
  run_ends_at: string;
};
type Finding = {
  id: string;
  finding_kind: string;
  severity: string;
  message_md: string;
  created_at: string;
};
type Rollup = {
  period_label: string;
  totals: {
    leads_7d: number;
    leads_28d: number;
    page_views_7d: number;
    page_views_28d: number;
    newsletter_opens_7d: number;
    active_sessions: number;
  };
  per_client: ClientRollup[];
  stewards: Steward[];
  top_findings: Finding[];
};

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function trend(curr: number, prior4w: number): { delta: number; pct: number } {
  // prior 4w period = (28d - 7d) → 21 days; normalize to 7-day equivalent
  const priorWeekly = prior4w / 3;
  if (priorWeekly === 0) return { delta: curr, pct: curr > 0 ? 1 : 0 };
  const pct = (curr - priorWeekly) / priorWeekly;
  return { delta: curr - priorWeekly, pct };
}

export default function CommandCenterPage() {
  const [data, setData] = useState<Rollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    fetch("/api/dashboard/command-center", { headers })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: Rollup) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-6 py-5">
          <p className="font-semibold text-rose-200">Command Center unavailable</p>
          <p className="mt-2 text-sm text-rose-200/80">{error}</p>
          <p className="mt-4 text-xs text-zinc-500">
            This page is admin-only. Sign in with an admin account to view the
            cross-brand rollup.
          </p>
        </div>
      </main>
    );
  }
  if (!data) return null;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl text-white">
            <Sparkles className="h-7 w-7 text-amber-300" />
            Command Center
          </h1>
          <p className="text-sm text-zinc-400">
            The federation at a glance · last 7 days unless labeled.{" "}
            <Link
              href="/oracle"
              className="text-amber-200 underline-offset-2 hover:underline"
            >
              what is this →
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          {data.totals.active_sessions} sessions live (30 min)
        </div>
      </div>

      {/* Federation totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Leads · 7d"
          value={fmt(data.totals.leads_7d)}
          subtext={`${fmt(data.totals.leads_28d)} in 28d`}
          Icon={Target}
          accent="text-emerald-300"
        />
        <Kpi
          label="Page views · 7d"
          value={fmt(data.totals.page_views_7d)}
          subtext={`${fmt(data.totals.page_views_28d)} in 28d`}
          Icon={Activity}
          accent="text-sky-300"
        />
        <Kpi
          label="Newsletter opens · 7d"
          value={fmt(data.totals.newsletter_opens_7d)}
          subtext="across all brands"
          Icon={Mail}
          accent="text-purple-300"
        />
        <Kpi
          label="Sessions · live"
          value={fmt(data.totals.active_sessions)}
          subtext="last 30 minutes"
          Icon={Activity}
          accent="text-amber-300"
        />
        <Kpi
          label="Active brands"
          value={fmt(data.per_client.length)}
          subtext="surfacing here"
          Icon={Crown}
          accent="text-fuchsia-300"
        />
      </div>

      {/* Per-client cards */}
      <div>
        <h2 className="mb-3 font-serif text-xl text-white">Per brand · 7-day</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.per_client.map((c) => {
            const t = trend(c.leads_7d, Math.max(0, c.leads_28d - c.leads_7d));
            return (
              <Card key={c.slug} className="border-zinc-800 bg-zinc-950/40">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base text-white">
                    <span>{c.label}</span>
                    <Link
                      href={`/dashboard/analytics?brand=${c.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-normal text-zinc-400 hover:text-zinc-200"
                    >
                      drill in <ExternalLink className="h-3 w-3" />
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      {fmt(c.leads_7d)}
                    </span>
                    <span className="text-xs text-zinc-500">leads</span>
                    <TrendPill pct={t.pct} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Mini label="page views" value={fmt(c.page_views_7d)} />
                    <Mini label="newsletter" value={fmt(c.newsletter_opens_7d)} />
                    <Mini label="live sessions" value={fmt(c.active_sessions_30min)} />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Last lead: {fmtAgo(c.last_lead_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stewards + Findings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-amber-400/20 bg-zinc-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-200">
              <Crown className="h-4 w-4" />
              Active Pantheon stewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.stewards.length === 0 ? (
              <p className="text-sm text-zinc-500">No active runs.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.stewards.map((s) => {
                  const remaining = new Date(s.run_ends_at).getTime() - Date.now();
                  const days = Math.max(0, Math.floor(remaining / 86_400_000));
                  return (
                    <li
                      key={s.domain}
                      className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5 last:border-0 last:pb-0"
                    >
                      <span className="text-zinc-300">
                        {s.domain}
                      </span>
                      <span className="text-zinc-200">
                        {s.steward_name || "—"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {days}d left
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-zinc-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              Top unresolved findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_findings.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nothing flagged. Hades is watching.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {data.top_findings.map((f) => (
                  <li key={f.id} className="border-b border-zinc-800/60 pb-2 last:border-0 last:pb-0">
                    <div className="mb-1 flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs text-zinc-500">
                        {f.finding_kind}
                      </span>
                    </div>
                    <p className="text-zinc-300">{f.message_md}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {fmtAgo(f.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="pt-2 text-center text-xs text-zinc-600">
        Powered by Omni&nbsp;AI · Pantheon command center · live data
      </p>
    </main>
  );
}

function Kpi({
  label,
  value,
  subtext,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  subtext: string;
  Icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/40">
      <CardContent className="p-5">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
          <Icon className={`h-4 w-4 ${accent}`} />
          {label}
        </div>
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="mt-1 text-xs text-zinc-500">{subtext}</p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800/60 bg-black/30 px-2 py-1.5 text-center">
      <p className="text-sm font-semibold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function TrendPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  const cls = up
    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
    : "border-rose-400/40 bg-rose-500/10 text-rose-200";
  const arrow = up ? "▲" : "▼";
  const display =
    Math.abs(pct) >= 10 ? "≫" : `${Math.abs(Math.round(pct * 100))}%`;
  return (
    <span
      className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      <TrendingUp className="h-3 w-3" />
      {arrow} {display}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    info: "border-zinc-700/60 bg-zinc-900/60 text-zinc-300",
    low: "border-sky-400/40 bg-sky-500/10 text-sky-200",
    medium: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    high: "border-orange-400/40 bg-orange-500/10 text-orange-200",
    critical: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  };
  return (
    <Badge className={cls[severity] || cls.info}>{severity}</Badge>
  );
}

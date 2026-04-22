"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TrendingUp, GitCommit, AlertTriangle, Target } from "lucide-react";

interface Client {
  slug: string;
  name: string;
  emoji: string;
  current_mrr_usd: number;
  current_arr_usd: number;
  arr_target_usd: number;
  progress_pct: number;
  severity: "red" | "yellow" | "green";
  spark: number[];
  last_ship: { title: string; kind: string; created_at: string } | null;
  open_risks: { red: number; yellow: number };
}
interface Ship {
  id: string;
  client_slug: string | null;
  kind: string;
  title: string;
  unlocks: string | null;
  shipped_by: string;
  created_at: string;
}
interface Risk {
  id: string;
  client_slug: string;
  severity: "red" | "yellow" | "green";
  title: string;
  opened_at: string;
  resolved_at: string | null;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n}`;
const tAgo = (d: string) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
  return dy > 0 ? `${dy}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now";
};

function Spark({ values }: { values: number[] }) {
  if (!values || values.length < 2) {
    return <div className="h-6 w-full rounded bg-white/[0.02]" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${24 - ((v - min) / range) * 22}`)
    .join(" ");
  return (
    <svg className="w-full h-6" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="rgb(16 185 129 / 0.8)" strokeWidth="1.2" />
    </svg>
  );
}

export function ClientPortfolioPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [totals, setTotals] = useState({ arr: 0, mrr: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/portfolio/clients");
      if (r.ok) {
        const j = await r.json();
        setClients(j.clients || []);
        setTotals({ arr: j.portfolio_arr_usd || 0, mrr: j.portfolio_mrr_usd || 0 });
      }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="cc-p">
      <div className="cc-h flex items-center gap-2">
        <Target className="w-3.5 h-3.5 text-emerald-400 inline mr-2" />
        CLIENT PORTFOLIO
        <span className="ml-auto flex items-center gap-3 text-[10px] font-mono">
          <span className="text-gray-500">ARR <span className="text-emerald-400">{fmtMoney(totals.arr)}</span></span>
          <span className="text-gray-500">MRR <span className="text-emerald-400">{fmtMoney(totals.mrr)}</span></span>
        </span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
        {loading && clients.length === 0 ? (
          <p className="col-span-full text-xs font-mono text-gray-600 text-center py-6">Loading portfolio…</p>
        ) : (
          clients.map((c) => {
            const sevColor = c.severity === "red" ? "bg-red-500" : c.severity === "yellow" ? "bg-yellow-500" : "bg-emerald-500";
            return (
              <Link
                key={c.slug}
                href={`/command/client/${c.slug}`}
                className="group rounded-lg border border-white/[.05] bg-white/[.015] p-3 hover:border-emerald-500/30 hover:bg-emerald-500/[.03] transition"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{c.emoji || "📦"}</span>
                  <span className="text-sm font-mono font-medium text-white truncate flex-1">{c.name}</span>
                  <span className={`w-2 h-2 rounded-full ${sevColor}`} />
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-lg font-mono font-bold text-emerald-400">{fmtMoney(c.current_arr_usd)}</span>
                  <span className="text-[10px] font-mono text-gray-600">ARR</span>
                  <span className="ml-auto text-[10px] font-mono text-gray-500">{c.progress_pct}% → $1M</span>
                </div>
                <div className="h-1.5 w-full rounded bg-white/[.04] overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                    style={{ width: `${c.progress_pct}%` }}
                  />
                </div>
                <Spark values={c.spark} />
                <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono text-gray-600">
                  <span className="truncate">{c.last_ship ? c.last_ship.title : "no ships yet"}</span>
                  <span className="shrink-0 ml-2">{c.last_ship ? tAgo(c.last_ship.created_at) : "—"}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  feature: "text-emerald-400",
  fix: "text-yellow-400",
  infra: "text-cyan-400",
  content: "text-purple-400",
  deal: "text-orange-400",
  milestone: "text-pink-400",
};

export function BuildLogPanel() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    const url = filter === "all" ? "/api/portfolio/build-log?limit=80" : `/api/portfolio/build-log?limit=80&client=${filter}`;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        setShips(j.entries || []);
      }
    } catch {}
  }, [filter]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="cc-p h-full flex flex-col">
      <div className="cc-h flex items-center gap-2">
        <GitCommit className="w-3.5 h-3.5 text-emerald-400 inline mr-2" />
        BUILD LOG
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-400">LIVE</span>
        </span>
      </div>
      <div className="px-3 py-2 border-b border-white/[.05] flex gap-1 overflow-x-auto">
        {["all", "omni-ai", "omni-leads", "imperium", "cps", "leifson-built", "youngs-cabinet", "love-thy-barber", "north-peak", "alira", "prime-iv", "ai-digital-mkt", "seo-ppc"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap ${
                filter === s ? "bg-emerald-500/15 text-emerald-400" : "text-gray-600 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          )
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[400px]">
        {ships.length === 0 ? (
          <p className="text-xs font-mono text-gray-600 text-center py-6">No ships yet — go build.</p>
        ) : (
          ships.map((s) => (
            <div key={s.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/[.02]">
              <span className="text-[9px] font-mono text-gray-600 shrink-0 tabular-nums">
                {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className={`text-[9px] font-mono uppercase shrink-0 ${KIND_COLOR[s.kind] || "text-gray-400"}`}>
                {s.kind}
              </span>
              <span className="text-[10px] font-mono text-gray-500 shrink-0">{s.client_slug || "—"}</span>
              <span className="text-[11px] font-mono text-gray-200 flex-1 truncate">{s.title}</span>
              {s.unlocks && <span className="text-[9px] font-mono text-emerald-500/70 shrink-0 hidden md:inline">→ {s.unlocks}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RiskLanesPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);

  const load = useCallback(async () => {
    try {
      const [cr, rr] = await Promise.all([
        fetch("/api/portfolio/clients").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/portfolio/build-log?limit=30").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (cr) setClients(cr.clients || []);
      if (rr) {
        // Derive NOW/NEXT lanes from recent ships; BLOCKED from red-severity clients
        setRisks(rr.entries || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const blocked = clients.filter((c) => c.severity === "red");
  const warming = clients.filter((c) => c.severity === "yellow");
  const shipping = clients
    .filter((c) => c.severity === "green" && c.last_ship)
    .sort((a, b) => (b.last_ship ? new Date(b.last_ship.created_at).getTime() : 0) - (a.last_ship ? new Date(a.last_ship.created_at).getTime() : 0))
    .slice(0, 6);

  const Lane = ({ label, color, items, empty }: { label: string; color: string; items: Client[]; empty: string }) => (
    <div className="flex-1 min-w-[200px]">
      <p className={`text-[10px] font-mono uppercase tracking-widest mb-2 ${color}`}>{label}</p>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className="text-[10px] font-mono text-gray-700">{empty}</p>
        ) : (
          items.map((c) => (
            <Link
              key={c.slug}
              href={`/command/client/${c.slug}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/[.05] bg-white/[.015] hover:bg-white/[.03]"
            >
              <span>{c.emoji}</span>
              <span className="text-xs font-mono text-gray-300 flex-1 truncate">{c.name}</span>
              <span className="text-[9px] font-mono text-gray-600">{fmtMoney(c.current_mrr_usd)}/mo</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="cc-p">
      <div className="cc-h flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 inline mr-2" />
        NOW · NEXT · BLOCKED
      </div>
      <div className="p-4 flex flex-wrap gap-4">
        <Lane label="🟢 SHIPPING" color="text-emerald-400" items={shipping} empty="nothing green yet" />
        <Lane label="🟡 WARMING" color="text-yellow-400" items={warming} empty="no warming" />
        <Lane label="🔴 BLOCKED" color="text-red-400" items={blocked} empty="nothing blocked" />
      </div>
    </div>
  );
}

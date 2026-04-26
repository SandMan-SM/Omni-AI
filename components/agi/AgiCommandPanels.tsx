"use client";

import { useEffect, useState } from "react";
import { Building2, AlertTriangle, Activity, Zap, TrendingUp } from "lucide-react";

// Wave D: AGI panels for the /command page (next to portfolio panels)

type AGIBusiness = {
  id: string;
  name: string;
  industry: string | null;
  plan: string;
  subscription_status: string;
  stats: { leads: number; replies: number; bookings: number };
};

type AGIRun = {
  id: string;
  run_type: string;
  status: string;
  progress_pct: number;
  created_at: string;
};

type AGIRec = {
  id: string;
  priority: string;
  recommendation: string;
  rationale: string | null;
  lead?: { first_name: string | null; company: string | null } | null;
};

const panelCSS = "border border-emerald-500/[0.08] rounded-xl bg-white/[0.01] overflow-hidden";
const headerCSS = "px-3.5 py-2.5 bg-emerald-500/[0.03] border-b border-emerald-500/[0.08] font-mono text-[10px] tracking-[0.1em] text-white/50 uppercase";

export function AgiBusinessesPanel() {
  const [data, setData] = useState<{ businesses: AGIBusiness[]; system_totals: { businesses_count: number; leads: number; replies: number; bookings: number } } | null>(null);

  useEffect(() => {
    fetch("/api/agi/admin/businesses").then(r => r.json()).then(setData);
  }, []);

  return (
    <div className={panelCSS}>
      <div className={headerCSS}>
        <Building2 className="w-3 h-3 inline mr-1.5 -mt-0.5" />
        AGI · Business Portfolio
      </div>
      <div className="p-3 space-y-1.5">
        {!data ? <div className="text-xs text-white/30">Loading…</div> :
          (data.businesses ?? []).map(b => (
            <div key={b.id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{b.name}</div>
                <div className="text-[10px] text-white/40 truncate">
                  {b.industry} · {b.plan ?? "starter"} · {b.subscription_status ?? "trialing"}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/60 flex-shrink-0">
                <span className="text-purple-300">{b.stats.leads} leads</span>
                <span className="text-emerald-300">{b.stats.replies} replies</span>
                <span className="text-blue-300">{b.stats.bookings} mtgs</span>
              </div>
            </div>
          ))
        }
        {data && (
          <div className="border-t border-white/5 pt-2 mt-2 flex items-center justify-between text-[10px]">
            <span className="text-white/40 uppercase tracking-wider">System total</span>
            <span className="text-emerald-400 font-mono">
              {data.system_totals.businesses_count}b · {data.system_totals.leads}l · {data.system_totals.replies}r · {data.system_totals.bookings}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgiRisksPanel() {
  const [recs, setRecs] = useState<AGIRec[]>([]);

  useEffect(() => {
    fetch("/api/agi/admin/businesses").then(r => r.json()).then(d => {
      const bid = d.businesses?.[0]?.id;
      if (!bid) return;
      fetch(`/api/agi/coach/recommendations?business_id=${bid}`)
        .then(r => r.json())
        .then(j => setRecs((j.recommendations ?? []).filter((x: AGIRec) => x.priority === "high")));
    });
  }, []);

  return (
    <div className={panelCSS}>
      <div className={headerCSS}>
        <AlertTriangle className="w-3 h-3 inline mr-1.5 -mt-0.5 text-red-400" />
        AGI · Coach High-Priority
      </div>
      <div className="p-3 space-y-1.5">
        {recs.length === 0 ? (
          <div className="text-xs text-white/30 italic">No high-priority items</div>
        ) : recs.slice(0, 5).map(r => (
          <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg border border-red-500/15 bg-red-500/[0.04]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white/90 leading-tight">{r.recommendation}</div>
              {r.rationale && (
                <div className="text-[10px] text-white/40 mt-0.5 truncate">{r.rationale}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgiRunsPanel() {
  const [runs, setRuns] = useState<AGIRun[]>([]);

  useEffect(() => {
    fetch("/api/agi/admin/businesses").then(r => r.json()).then(d => {
      const bid = d.businesses?.[0]?.id;
      if (!bid) return;
      fetch(`/api/agi/runs?business_id=${bid}&limit=10`).then(r => r.json()).then(j => setRuns(j.runs ?? []));
    });
  }, []);

  function tAgo(d: string) {
    if (!d) return "—";
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
    return dy > 0 ? `${dy}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now";
  }

  function statusColor(s: string) {
    return s === "completed" ? "text-emerald-400"
         : s === "running"   ? "text-yellow-400"
         : s === "failed"    ? "text-red-400"
         :                     "text-white/40";
  }

  return (
    <div className={panelCSS}>
      <div className={headerCSS}>
        <Activity className="w-3 h-3 inline mr-1.5 -mt-0.5 text-emerald-400" />
        AGI · Recent Agent Runs
      </div>
      <div className="p-3 space-y-1.5">
        {runs.length === 0 ? (
          <div className="text-xs text-white/30 italic">No agent runs yet</div>
        ) : runs.slice(0, 8).map(r => (
          <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/[0.02]">
            <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono text-white/80 truncate">{r.run_type}</div>
            </div>
            <span className={`text-[10px] font-mono uppercase ${statusColor(r.status)}`}>
              {r.status}
            </span>
            <span className="text-[10px] text-white/30 font-mono">{tAgo(r.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

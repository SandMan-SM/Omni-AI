"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Rocket, AlertTriangle, TrendingUp, GitCommit, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n}`;
const tAgo = (d: string) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), dy = Math.floor(h / 24);
  return dy > 0 ? `${dy}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now";
};

function Chart({ points, height = 120 }: { points: number[]; height?: number }) {
  if (!points || points.length < 2) return <div style={{ height }} className="rounded bg-white/[.02]" />;
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = max - min || 1;
  const path = points
    .map((v, i) => `${(i / (points.length - 1)) * 100},${100 - ((v - min) / range) * 95}`)
    .join(" ");
  return (
    <svg className="w-full" style={{ height }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16 185 129 / .4)" />
          <stop offset="100%" stopColor="rgb(16 185 129 / 0)" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${path} 100,100`} fill="url(#g)" />
      <polyline points={path} fill="none" stroke="rgb(16 185 129)" strokeWidth="1" />
    </svg>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const { user, loading: authLoading } = useAuth();
  const { profileLoading, isAdmin } = useProfile();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [genReview, setGenReview] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await fetch(`/api/portfolio/client/${slug}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  if (authLoading || profileLoading || loading)
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  if (!user || !isAdmin)
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <p className="text-sm font-mono text-red-400">Admin only</p>
      </div>
    );
  if (!data?.client) return <div className="p-8 text-gray-400">Client not found.</div>;

  const c = data.client;
  const metrics = data.metrics || [];
  const ships = data.ships || [];
  const risks = data.risks || [];
  const mrrSeries = metrics.map((m: any) => m.mrr_usd || 0);
  const target = c.arr_target_usd || 1_000_000;

  const openReview = async () => {
    setGenReview(true);
    try {
      window.open(`/api/portfolio/review/${slug}`, "_blank");
    } finally {
      setTimeout(() => setGenReview(false), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-[#030305] text-white">
      <style>{`.cc-p{border:1px solid rgba(16,185,129,.08);border-radius:12px;background:rgba(255,255,255,.01);overflow:hidden}.cc-h{padding:10px 14px;background:rgba(16,185,129,.03);border-bottom:1px solid rgba(16,185,129,.08);font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.5);text-transform:uppercase}`}</style>
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        <Link href="/command" className="inline-flex items-center gap-2 text-xs font-mono text-gray-500 hover:text-emerald-400 mb-4">
          <ArrowLeft className="w-3 h-3" /> back to command
        </Link>

        {/* Hero */}
        <div className="cc-p mb-4">
          <div className="p-6 flex flex-wrap items-start gap-6">
            <span className="text-6xl">{c.emoji}</span>
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-2xl font-mono font-bold text-white mb-1">{c.name}</h1>
              <p className="text-xs font-mono text-gray-500 mb-3">{c.stack || "—"} · status: {c.status}</p>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-mono font-bold text-emerald-400">{fmtMoney(c.current_arr_usd)}</span>
                <span className="text-xs font-mono text-gray-600">ARR</span>
                <span className="text-lg font-mono text-cyan-400 ml-3">{fmtMoney(c.current_mrr_usd)}</span>
                <span className="text-xs font-mono text-gray-600">MRR</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded bg-white/[.05] overflow-hidden max-w-md">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-yellow-400"
                    style={{ width: `${c.progress_pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400">
                  {c.progress_pct}% → {fmtMoney(target)}
                </span>
              </div>
              {c.notes && <p className="text-xs font-mono text-gray-500 mt-3 italic">{c.notes}</p>}
            </div>
            <button
              onClick={openReview}
              disabled={genReview}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              {genReview ? "opening…" : "Generate investor review"}
            </button>
          </div>
        </div>

        {/* Chart + Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="cc-p lg:col-span-2">
            <div className="cc-h">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 inline mr-2" />
              90-DAY MRR TRAJECTORY
            </div>
            <div className="p-4">
              <Chart points={mrrSeries} height={160} />
              <div className="flex justify-between text-[10px] font-mono text-gray-600 mt-2">
                <span>{metrics[0]?.date || "—"}</span>
                <span>{metrics[metrics.length - 1]?.date || "—"}</span>
              </div>
            </div>
          </div>
          <div className="cc-p">
            <div className="cc-h">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 inline mr-2" />
              RISKS
            </div>
            <div className="p-4 space-y-2 max-h-[220px] overflow-y-auto">
              {risks.length === 0 ? (
                <p className="text-xs font-mono text-gray-600">No open risks. 🟢</p>
              ) : (
                risks.map((r: any) => (
                  <div
                    key={r.id}
                    className={`p-2 rounded border ${
                      r.severity === "red"
                        ? "border-red-500/30 bg-red-500/5"
                        : r.severity === "yellow"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-emerald-500/30 bg-emerald-500/5"
                    }`}
                  >
                    <p className="text-xs font-mono text-white">{r.title}</p>
                    {r.detail && <p className="text-[10px] font-mono text-gray-500 mt-0.5">{r.detail}</p>}
                    <p className="text-[9px] font-mono text-gray-600 mt-1">
                      {r.resolved_at ? "✅ resolved" : `opened ${tAgo(r.opened_at)} ago`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ships */}
        <div className="cc-p">
          <div className="cc-h">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400 inline mr-2" />
            RECENT SHIPS ({ships.length})
          </div>
          <div className="p-4 space-y-2">
            {ships.length === 0 ? (
              <p className="text-xs font-mono text-gray-600 text-center py-4">No ships yet — go build.</p>
            ) : (
              ships.map((s: any) => (
                <div key={s.id} className="flex items-start gap-3 p-2 rounded border border-white/[.04] bg-white/[.015]">
                  <Rocket className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono uppercase text-emerald-500/70">{s.kind}</span>
                      <span className="text-xs font-mono text-white">{s.title}</span>
                    </div>
                    {s.detail && <p className="text-[10px] font-mono text-gray-500 mt-0.5">{s.detail}</p>}
                    {s.unlocks && <p className="text-[10px] font-mono text-emerald-500/70 mt-0.5">→ unlocks: {s.unlocks}</p>}
                    {s.file_paths?.length > 0 && (
                      <p className="text-[9px] font-mono text-gray-600 mt-0.5 truncate">{s.file_paths.join(" · ")}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-gray-600 shrink-0">{tAgo(s.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

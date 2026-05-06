"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";
import { Brain, Sparkles, AlertTriangle, TrendingUp, ArrowRight, RefreshCw } from "lucide-react";

type Recommendation = {
  id: string;
  recommendation_type: string;
  priority: "high" | "medium" | "low";
  recommendation: string;
  rationale: string | null;
  lead?: { first_name: string | null; last_name: string | null; company: string | null } | null;
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low: "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  next_action: ArrowRight,
  risk_alert: AlertTriangle,
  opportunity: TrendingUp,
};

// Wave B: AI Coach panel for command-center.tsx
// Pulls /api/agi/coach/recommendations. Replaces / supplements static alerts.
export function AgiCoachAlerts() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(bid: string) {
    setLoading(true);
    try {
      const r = await authFetch(`/api/agi/coach/recommendations?business_id=${bid}`);
      if (!r.ok) {
        setRecs([]);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setRecs(Array.isArray(j?.recommendations) ? j.recommendations : []);
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    if (!businessId) return;
    setGenerating(true);
    try {
      await authFetch("/api/agi/coach/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });
      await load(businessId);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    authFetch("/api/agi/admin/businesses")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const first = d?.businesses?.[0];
        if (first) {
          setBusinessId(first.id);
          load(first.id);
        }
      })
      .catch(() => {});
  }, []);

  if (loading || recs.length === 0) {
    return (
      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.04] via-blue-500/[0.04] to-emerald-500/[0.04] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
            <Brain className="w-4 h-4" /> AI Coach Recommendations
          </div>
          <button
            onClick={regenerate}
            disabled={generating || !businessId}
            className="text-[10px] px-2 py-1 rounded border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generating ? "Analyzing..." : "Generate"}
          </button>
        </div>
        <div className="text-xs text-gray-500 italic">
          {loading ? "Loading…" : "No recommendations yet. Click Generate to have Claude analyze your pipeline."}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.04] via-blue-500/[0.04] to-emerald-500/[0.04] p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
          <Brain className="w-4 h-4" /> AI Coach · {recs.length} recommendations
        </div>
        <button
          onClick={regenerate}
          disabled={generating}
          className="text-[10px] px-2 py-1 rounded border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 inline-flex items-center gap-1"
        >
          {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </div>
      <div className="space-y-1.5">
        {recs.slice(0, 5).map(r => {
          const Icon = TYPE_ICONS[r.recommendation_type] ?? Sparkles;
          return (
            <div
              key={r.id}
              className={`flex items-start gap-2 p-2.5 rounded-lg border ${PRIORITY_COLORS[r.priority]}`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold leading-tight">{r.recommendation}</div>
                {r.rationale && (
                  <div className="text-[10px] opacity-70 mt-0.5 line-clamp-1">{r.rationale}</div>
                )}
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-60">
                {r.priority}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

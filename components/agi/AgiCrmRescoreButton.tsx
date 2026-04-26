"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

// Wave A: bulk AI re-score for the CRM. Calls /api/agi/leads/bulk-score
// and fans out to a configurable business_id. Reads first business from
// /api/agi/admin/businesses by default.
export function AgiCrmRescoreButton({ onComplete }: { onComplete?: () => void }) {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ scored: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agi/admin/businesses")
      .then(r => r.json())
      .then(d => {
        const first = d.businesses?.[0];
        if (first) setBusinessId(first.id);
      })
      .catch(() => {});
  }, []);

  async function rescore() {
    if (!businessId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/agi/leads/bulk-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId, max_leads: 25 }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "scoring failed");
      setResult({ scored: j.scored, total: j.total_attempted });
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={rescore}
        disabled={loading || !businessId}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? "Scoring with Claude..." : "AI Re-score All"}
      </button>
      {result && (
        <span className="text-[10px] text-emerald-400">
          ✓ {result.scored} scored
        </span>
      )}
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}

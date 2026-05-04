"use client";

/**
 * Client-facing Arena tab. Replaces AgiArenaManager when the agentic panel
 * is rendered for a non-admin viewer (CPS / Brent / Adam / Sammy).
 *
 * Shows their own agent (1 row scoped to active workspace), an editable
 * agent_name field, and a "Visit Public Arena →" link. No leaderboard
 * management, no bulk actions — just their agent.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, ExternalLink, RefreshCw, Loader2, Save } from "lucide-react";

interface AgentRow {
  id: string;
  agentName: string;
  businessName: string | null;
  rank: string;
  elo: number;
  tier: number;
  campaigns: number;
  activities: number;
  agentStatus: string;
  leaderboardPosition: number;
}

const RANK_CONFIG: Record<string, { label: string; gradient: string }> = {
  diamond:  { label: "DIAMOND",  gradient: "from-cyan-300 via-blue-400 to-purple-500" },
  gold:     { label: "GOLD",     gradient: "from-yellow-300 via-amber-400 to-orange-500" },
  silver:   { label: "SILVER",   gradient: "from-slate-200 via-slate-300 to-slate-500" },
  bronze:   { label: "BRONZE",   gradient: "from-orange-400 via-amber-600 to-yellow-700" },
  unranked: { label: "UNRANKED", gradient: "from-gray-700 via-gray-600 to-gray-500" },
};

export function ClientArenaPanel() {
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const bizId = typeof window !== "undefined"
        ? window.localStorage.getItem("omni_active_business_id")
        : null;
      const res = await fetch("/api/agents/rankings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all: AgentRow[] = await res.json();
      // Resolve the active workspace's slug/name so we can pick the right row.
      const { supabase } = await import("@/lib/agi-supabase");
      const { data: biz } = bizId
        ? await supabase.from("omni_businesses").select("name,slug").eq("id", bizId).maybeSingle()
        : { data: null };
      const target = (biz?.name ?? "").toLowerCase();
      const found = all.find(a => (a.businessName ?? "").toLowerCase() === target);
      setAgent(found || null);
      setEditingName(found?.agentName ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Re-load when the active workspace changes — without this the panel
  // shows the previous client's agent until a hard reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== "omni_active_business_id") return;
      load();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveName = async () => {
    if (!agent || !editingName.trim() || editingName === agent.agentName) return;
    setSaving(true);
    try {
      // The agent name lives on the omni_businesses row (verified via the
      // agent_name column the dashboard PATCH endpoint accepts).
      const bizId = typeof window !== "undefined"
        ? window.localStorage.getItem("omni_active_business_id")
        : null;
      if (!bizId) throw new Error("no active workspace");
      const r = await fetch("/api/agi/businesses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bizId, agent_name: editingName.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
        Couldn&apos;t load your agent: {error}
      </div>
    );
  }
  if (!agent) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-8 space-y-4">
        <div className="text-sm text-gray-400">
          We couldn&apos;t find an arena agent for this workspace yet. It will appear here once it&apos;s seeded.
        </div>
        <Link
          href="/arena"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition"
        >
          <Trophy className="w-4 h-4" />
          Visit Public Arena
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const rank = RANK_CONFIG[agent.rank?.toLowerCase()] ?? RANK_CONFIG.unranked;

  return (
    <div className="space-y-6 p-2 sm:p-4">
      {/* Agent card */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-emerald-500/[0.02] to-purple-500/[0.03] p-6 overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${rank.gradient}`} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${rank.gradient} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
              #{agent.leaderboardPosition || "—"}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80">
                {rank.label} TIER
              </div>
              <h3 className="text-2xl font-bold text-white mt-0.5">{agent.agentName}</h3>
              <div className="text-xs text-gray-400 mt-1">{agent.businessName}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">ELO</div>
            <div className="text-3xl font-bold text-white tabular-nums">{agent.elo}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Campaigns</div>
            <div className="text-lg font-bold text-white tabular-nums">{agent.campaigns}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Activities</div>
            <div className="text-lg font-bold text-white tabular-nums">{agent.activities}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Status</div>
            <div className="text-sm font-semibold text-emerald-400 capitalize">{agent.agentStatus || "active"}</div>
          </div>
        </div>
      </div>

      {/* Rename */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <label className="block text-[11px] uppercase tracking-widest text-gray-400 mb-2">
          Your agent&apos;s name
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            placeholder="e.g. Apollo, Atlas, Mercury…"
            maxLength={60}
            className="flex-1 min-w-[200px] h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40"
          />
          <button
            onClick={saveName}
            disabled={saving || editingName === agent.agentName || !editingName.trim()}
            className="h-10 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-medium disabled:opacity-40 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
        {savedFlash && (
          <p className="text-xs text-emerald-400 mt-2">Saved — your agent will use this name on the public arena.</p>
        )}
      </div>

      {/* Visit public arena */}
      <Link
        href="/arena"
        target="_blank"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 text-sm font-medium hover:bg-emerald-500/10 transition"
      >
        <Trophy className="w-4 h-4" />
        Visit Public Arena
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>

      <button
        onClick={load}
        className="ml-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}

export default ClientArenaPanel;

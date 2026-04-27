"use client";

// Arena management surface — list of agents using the SAME card layout
// as the public /arena leaderboard cards. Same data only:
//   avatar · name (business · owner) · rank chip · ELO · #position
//   value · rating · reach · tier · premium · status
//
// No winrate, no streak, no W/L records — those aren't on the public
// cards. Source: /api/agents/rankings.

import { useEffect, useState, useCallback } from "react";
import { Trophy, RefreshCw, Loader2, ExternalLink, Search, Crown, Star } from "lucide-react";

interface Agent {
  id: string;
  agentName: string;
  businessName: string | null;
  ownerName: string | null;
  rank: string;          // diamond | gold | silver | bronze | unranked
  elo: number;
  avatar: string | null;
  tier: number;
  isPremium: boolean;
  crmStatus: string | null;
  revenue: number;
  reach?: number;
  campaigns: number;
  activities: number;
  agentStatus: string;
  createdAt: string;
  leaderboardPosition: number;
}

const RANK_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  diamond:  { color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  label: "DIAMOND" },
  gold:     { color: "#facc15", bg: "rgba(250,204,21,0.12)",  label: "GOLD" },
  silver:   { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", label: "SILVER" },
  bronze:   { color: "#b45309", bg: "rgba(180,83,9,0.18)",    label: "BRONZE" },
  unranked: { color: "#666",    bg: "rgba(100,100,100,0.18)", label: "UNRANKED" },
};

const TIER_NAME: Record<number, string> = {
  0: "TIER 1", 1: "TIER 2", 2: "TIER 3", 3: "TIER 4", 4: "TIER 5",
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function getRating(businessName: string | null): string {
  // Public arena hard-codes 5.0 for Omni AI, 0.0 elsewhere — mirror it here.
  return businessName === "Omni AI" ? "5.0" : "0.0";
}

export function AgiArenaManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/agents/rankings", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setAgents(Array.isArray(data) ? data : data.agents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load arena agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? agents.filter(a =>
        a.agentName.toLowerCase().includes(q) ||
        (a.businessName ?? "").toLowerCase().includes(q) ||
        (a.ownerName ?? "").toLowerCase().includes(q)
      )
    : agents;

  return (
    <div style={{ background: "#0a0a0a", minHeight: 600, color: "#e8e8e8", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: "1px solid #1e1e1e",
        background: "linear-gradient(135deg, #1a1209 0%, #0d0d0d 100%)",
        flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #f59e0b, #f97316)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Trophy size={16} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Arena Agents</div>
            <div style={{ fontSize: 11, color: "#666" }}>
              {loading ? "Loading…" : `${agents.length} ${agents.length === 1 ? "agent" : "agents"}${q ? ` · ${filtered.length} match` : ""}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={load} disabled={loading} style={ctrlBtn(loading)}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
          </button>
          <a href="/arena" target="_blank" rel="noreferrer" style={ctrlLink}>
            <ExternalLink size={12} /> Public page
          </a>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8, padding: "8px 12px" }}>
          <Search size={13} color="#555" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents, business, or owner…"
            style={{ background: "transparent", border: "none", outline: "none", color: "#e8e8e8", fontSize: 13, flex: 1, minWidth: 0 }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}>
              clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#2a0d0d", border: "1px solid #f8717140", color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Cards grid */}
      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#444", fontSize: 13 }}>
            <Loader2 size={20} className="animate-spin" style={{ display: "inline-block" }} /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#444", fontSize: 13 }}>
            {search ? `No agents matching "${search}".` : "No agents in the arena yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filtered.map(a => <AgentCard key={a.id} agent={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const config = RANK_CONFIG[agent.rank.toLowerCase()] ?? RANK_CONFIG.unranked;
  const value = agent.revenue ?? 0;
  const reach = agent.reach ?? (agent.activities + agent.campaigns);
  const isActive = agent.agentStatus === "active";

  return (
    <div style={{
      position: "relative",
      background: "#0a0a0a",
      border: `1px solid ${config.color}30`,
      borderRadius: 14,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      transition: "border-color 0.15s",
    }}>
      {/* Header: avatar + name + active pill */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `linear-gradient(135deg, ${config.color}, ${config.color}aa)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#fff",
          flexShrink: 0,
          boxShadow: `0 4px 12px ${config.color}40`,
        }}>
          {agent.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, wordBreak: "break-word" }}>
            {agent.agentName}
          </div>
          {(agent.businessName || agent.ownerName) && (
            <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>
              {[agent.businessName, agent.ownerName].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <span style={{
          flexShrink: 0,
          fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6,
          color: isActive ? "#10b981" : "#666",
          background: isActive ? "#0d2a1e" : "#1a1a1a",
          border: `1px solid ${isActive ? "#10b98140" : "#222"}`,
          padding: "4px 9px", borderRadius: 6,
        }}>
          {agent.agentStatus}
        </span>
      </div>

      {/* Rank + ELO + position */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: config.color, background: config.bg,
          padding: "4px 10px", borderRadius: 999, letterSpacing: 0.7,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {config.label}
        </span>
        <span style={{
          fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#94a3b8",
          background: "rgba(255,255,255,0.04)", border: "1px solid #1e1e1e",
          padding: "4px 10px", borderRadius: 999,
        }}>
          ELO {agent.elo}
        </span>
        <span style={{
          fontSize: 10, color: "#666",
          background: "rgba(255,255,255,0.04)", border: "1px solid #1e1e1e",
          padding: "4px 10px", borderRadius: 999,
        }}>
          #{agent.leaderboardPosition}
        </span>
        {agent.isPremium && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#facc15",
            background: "rgba(250,204,21,0.12)", border: "1px solid #facc1540",
            padding: "4px 9px", borderRadius: 999,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <Crown size={10} /> PREMIUM
          </span>
        )}
      </div>

      {/* Stats Grid: Value / Rating / Reach */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Stat label="Value" value={`$${formatCompact(value)}`} />
        <Stat
          label="Rating"
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Star size={12} color="#facc15" fill="#facc15" /> {getRating(agent.businessName)}
            </span>
          }
        />
        <Stat label="Reach" value={formatCompact(reach)} />
      </div>

      {/* Tier */}
      <div style={{
        paddingTop: 10, borderTop: "1px solid #1a1a1a",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: config.color, letterSpacing: 0.7 }}>
          {TIER_NAME[agent.tier] ?? `TIER ${agent.tier + 1}`}
        </span>
        {agent.crmStatus && (
          <span style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {agent.crmStatus}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", padding: "8px 4px",
      background: "rgba(255,255,255,0.03)", borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{value}</div>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

const ctrlBtn = (loading: boolean): React.CSSProperties => ({
  background: "#191919", border: "1px solid #2a2a2a", color: "#cbd5e1",
  padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  cursor: loading ? "wait" : "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
});
const ctrlLink: React.CSSProperties = {
  background: "#191919", border: "1px solid #2a2a2a", color: "#cbd5e1",
  padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex", alignItems: "center", gap: 6,
};

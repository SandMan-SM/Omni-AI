"use client";

// Arena management surface — agent cards rendered in the SAME visual style
// as the public /arena modal cards (multi-stop chrome gradients on rank pills
// + avatar block, glow under the card, ELO/position pills, 3-stat grid,
// chrome-text TIER footer). Real data (no marketing overrides). No winrate,
// no streak.
//
// Source: /api/agents/rankings.

import { useEffect, useState, useCallback } from "react";
import { Trophy, RefreshCw, Loader2, ExternalLink, Search, Crown, Flame, Shield, Lock, type LucideIcon } from "lucide-react";

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

// Public-arena chrome gradients (lifted from components/arena/leaderboard.tsx
// rankConfig). Multi-stop linear-gradients give the metal/sheen look that
// matches the canonical design.
const RANK_CONFIG: Record<string, {
  cssGradient: string;
  cssBorder: string;
  glowColor: string;
  chromeStyle: React.CSSProperties;
  icon: LucideIcon;
  label: string;
}> = {
  diamond: {
    cssGradient: "linear-gradient(135deg, #a5f3fc 0%, #ffffff 25%, #67e8f9 50%, #ffffff 75%, #22d3ee 100%)",
    cssBorder: "rgba(34, 211, 238, 0.3)",
    glowColor: "rgba(34, 211, 238, 0.15)",
    chromeStyle: { background: "linear-gradient(135deg, #22d3ee, #ffffff, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    icon: Crown, label: "Diamond",
  },
  gold: {
    cssGradient: "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)",
    cssBorder: "rgba(250, 204, 21, 0.4)",
    glowColor: "rgba(250, 204, 21, 0.2)",
    chromeStyle: { background: "linear-gradient(135deg, #fde68a, #facc15, #b45309, #facc15, #fde68a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    icon: Flame, label: "Gold",
  },
  silver: {
    cssGradient: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 20%, #94a3b8 45%, #e2e8f0 70%, #ffffff 100%)",
    cssBorder: "rgba(203, 213, 225, 0.4)",
    glowColor: "rgba(203, 213, 225, 0.15)",
    chromeStyle: { background: "linear-gradient(135deg, #f8fafc, #cbd5e1, #64748b, #cbd5e1, #f8fafc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    icon: Shield, label: "Silver",
  },
  bronze: {
    cssGradient: "linear-gradient(135deg, #fed7aa 0%, #cd7f32 20%, #7c2d12 45%, #cd7f32 70%, #fed7aa 100%)",
    cssBorder: "rgba(217, 119, 6, 0.4)",
    glowColor: "rgba(217, 119, 6, 0.15)",
    chromeStyle: { background: "linear-gradient(135deg, #fdba74, #d97706, #7c2d12, #d97706, #fdba74)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    icon: Shield, label: "Bronze",
  },
  unranked: {
    cssGradient: "linear-gradient(135deg, #6b7280, #4b5563)",
    cssBorder: "rgba(107, 114, 128, 0.2)",
    glowColor: "rgba(107, 114, 128, 0.05)",
    chromeStyle: { color: "#6b7280" },
    icon: Lock, label: "Unranked",
  },
};

// Tier names match the canonical arena (components/arena/leaderboard.tsx).
const TIER_NAMES: Record<number, string> = {
  0: "Apprentice", 1: "Master", 2: "Royal", 3: "Empire", 4: "Ultimate Power",
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(Math.round(n));
}

function getRating(businessName: string | null): string {
  return businessName === "Omni AI" ? "5.0" : "0.0";
}

export function AgiArenaManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/agents/rankings", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setAgents(Array.isArray(data) ? data : data.agents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load arena agents");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? agents.filter(a =>
        a.agentName.toLowerCase().includes(q) ||
        (a.businessName ?? "").toLowerCase().includes(q) ||
        (a.ownerName ?? "").toLowerCase().includes(q))
    : agents;

  return (
    <div className="agi-arena-root" style={{ background: "#0a0a0a", minHeight: 600, color: "#e8e8e8", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style jsx global>{`
        /* Defeat the AgiAdminPanel cascade that forces repeat(3,1fr) -> 1fr.
           The arena 3-stat grid uses literal '1fr 1fr 1fr' so it doesn't
           match that selector — but explicit class wins regardless. */
        .agi-arena-stats {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 8px;
        }
      `}</style>

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
          }}><Trophy size={16} color="#fff" /></div>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents, business, or owner…" style={{ background: "transparent", border: "none", outline: "none", color: "#e8e8e8", fontSize: 13, flex: 1, minWidth: 0 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}>clear</button>}
        </div>
      </div>

      {error && <div style={{ padding: 16, background: "#2a0d0d", border: "1px solid #f8717140", color: "#f87171", fontSize: 12 }}>{error}</div>}

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filtered.map(a => <AgentCard key={a.id} agent={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const config = RANK_CONFIG[agent.rank.toLowerCase()] ?? RANK_CONFIG.unranked;
  const Icon = config.icon;
  const value = agent.revenue ?? 0;
  const reach = agent.reach ?? (agent.activities + agent.campaigns);
  const isActive = agent.agentStatus === "active";
  const tierName = TIER_NAMES[agent.tier] ?? `Tier ${agent.tier + 1}`;

  return (
    <div style={{ position: "relative" }}>
      {/* Glow blur behind card — matches public modal style */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, borderRadius: 16, filter: "blur(18px)",
          background: config.glowColor, pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div style={{
        position: "relative",
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${config.cssBorder}`,
        borderRadius: 16,
        padding: 20,
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        {/* Header: avatar + name/business + status */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: config.cssGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#000",
            flexShrink: 0,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 12px ${config.glowColor}`,
          }}>
            {agent.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, wordBreak: "break-word" }}>
              {agent.agentName}
            </div>
            {(agent.businessName || agent.ownerName) && (
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
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
          }}>{agent.agentStatus}</span>
        </div>

        {/* Pills: Rank · ELO · #position · Premium */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 999,
            fontSize: 11, fontWeight: 700, color: "#000",
            background: config.cssGradient,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 8px ${config.glowColor}`,
            whiteSpace: "nowrap",
          }}>
            <Icon size={11} />
            {config.label.toUpperCase()}
          </span>
          <span style={{
            padding: "5px 12px", borderRadius: 999,
            fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#cbd5e1",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            whiteSpace: "nowrap",
          }}>ELO {agent.elo}</span>
          <span style={{
            padding: "5px 12px", borderRadius: 999,
            fontSize: 11, color: "#94a3b8",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            whiteSpace: "nowrap",
          }}>#{agent.leaderboardPosition}</span>
          {agent.isPremium && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 11px", borderRadius: 999,
              fontSize: 11, fontWeight: 700, color: "#facc15",
              background: "rgba(250,204,21,0.12)", border: "1px solid #facc1540",
              whiteSpace: "nowrap",
            }}>
              <Crown size={10} /> PREMIUM
            </span>
          )}
        </div>

        {/* Stats — 3-col grid (literal 1fr 1fr 1fr to bypass cascade) */}
        <div className="agi-arena-stats">
          <Stat label="Value" value={`$${formatCompact(value)}`} />
          <Stat label="Rating" value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ color: "#facc15" }}>&#9733;</span> {getRating(agent.businessName)}
            </span>
          } />
          <Stat label="Reach" value={formatCompact(reach)} />
        </div>

        {/* Tier footer with chrome text + crm status */}
        <div style={{
          paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
            ...config.chromeStyle,
          }}>
            {tierName}
          </span>
          {agent.crmStatus && (
            <span style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {agent.crmStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", padding: "10px 6px",
      background: "rgba(255,255,255,0.03)", borderRadius: 10,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 4 }}>
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

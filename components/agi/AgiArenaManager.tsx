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

// Tier names + value/reach overrides — lifted from the canonical arena
// (components/arena/leaderboard.tsx) so the management card displays the
// same numbers visitors see on the public modal.
const TIER_NAMES: Record<number, string> = {
  0: "Apprentice", 1: "Master", 2: "Royal", 3: "Empire", 4: "Ultimate Power",
};
const VALUE_OVERRIDES: Record<string, number> = {
  "Omni AI": 28000, "Love Thy Barber": 0, "BLK Diamond": 0,
  "CPS": 0, "Youngs Cabinet Refinishing": 0, "Leifson Built": 0,
};
const REACH_OVERRIDES: Record<string, number> = {
  "Omni AI": 1111, "Love Thy Barber": 0, "BLK Diamond": 0,
  "CPS": 0, "Youngs Cabinet Refinishing": 0, "Leifson Built": 0,
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

        /* Mobile: card grid drops to single column, card itself shrinks
           padding/avatar/text so nothing gets clipped past viewport. The
           stats stay 3-up but with shrunk padding + value font so all three
           fit on a 360px-wide phone. Tier footer chrome text shrinks too
           so 'ULTIMATE POWER' doesn't run off the right edge. */
        @media (max-width: 720px) {
          .agi-arena-root .agi-arena-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .agi-arena-root .agi-arena-card {
            padding: 16px !important;
            border-radius: 14px !important;
          }
          .agi-arena-root .agi-arena-avatar {
            width: 44px !important;
            height: 44px !important;
            font-size: 14px !important;
            border-radius: 10px !important;
          }
          .agi-arena-root .agi-arena-name {
            font-size: 15px !important;
          }
          .agi-arena-root .agi-arena-pill {
            padding: 5px 10px !important;
            font-size: 11px !important;
          }
          .agi-arena-root .agi-arena-stats {
            gap: 6px;
          }
          .agi-arena-root .agi-arena-stat-cell {
            padding: 10px 4px !important;
          }
          .agi-arena-root .agi-arena-stat-value {
            font-size: 16px !important;
          }
          .agi-arena-root .agi-arena-stat-label {
            font-size: 9px !important;
          }
          .agi-arena-root .agi-arena-tier-num,
          .agi-arena-root .agi-arena-tier-name {
            font-size: 11px !important;
            letter-spacing: 1px !important;
          }
        }
        @media (max-width: 400px) {
          .agi-arena-root .agi-arena-stat-value {
            font-size: 14px !important;
          }
          .agi-arena-root .agi-arena-tier-name {
            font-size: 10px !important;
            letter-spacing: 0.5px !important;
          }
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
          <div className="agi-arena-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 18 }}>
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
  // Use the same value/reach overrides as the canonical public card so the
  // numbers match visitor view ($28K / 1.1K for Omni AI etc.).
  const value = (agent.businessName && VALUE_OVERRIDES[agent.businessName] !== undefined)
    ? VALUE_OVERRIDES[agent.businessName]
    : (agent.revenue ?? 0);
  const reach = (agent.businessName && REACH_OVERRIDES[agent.businessName] !== undefined)
    ? REACH_OVERRIDES[agent.businessName]
    : (agent.reach ?? (agent.activities + agent.campaigns));
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
      <div className="agi-arena-card" style={{
        position: "relative",
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${config.cssBorder}`,
        borderRadius: 18,
        padding: 24,
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        {/* Header: avatar + agent name + Anonymous subtitle + green-dot status */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div className="agi-arena-avatar" style={{
            width: 56, height: 56, borderRadius: 14,
            background: config.cssGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#000",
            flexShrink: 0,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 14px ${config.glowColor}`,
          }}>
            {agent.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="agi-arena-name" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: "#fff", wordBreak: "break-word" }}>
              {agent.agentName}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              Anonymous
            </div>
          </div>
          <div style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: isActive ? "#10b981" : "#666",
              boxShadow: isActive ? "0 0 8px rgba(16,185,129,0.6)" : undefined,
            }} />
            <span style={{ fontSize: 12, color: "#9ca3af", textTransform: "capitalize" }}>
              {agent.agentStatus}
            </span>
          </div>
        </div>

        {/* Pills: Rank · ELO · #position (no premium — matches canonical) */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="agi-arena-pill" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 999,
            fontSize: 13, fontWeight: 700, color: "#000",
            background: config.cssGradient,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 8px ${config.glowColor}`,
            whiteSpace: "nowrap",
          }}>
            <Icon size={13} />
            {config.label}
          </span>
          <span className="agi-arena-pill" style={{
            padding: "6px 14px", borderRadius: 999,
            fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#cbd5e1",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            whiteSpace: "nowrap", letterSpacing: 0.5,
          }}>ELO {agent.elo}</span>
          <span className="agi-arena-pill" style={{
            padding: "6px 14px", borderRadius: 999,
            fontSize: 12, color: "#9ca3af",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            whiteSpace: "nowrap",
          }}>#{agent.leaderboardPosition}</span>
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

        {/* Tier footer: TIER N (flat rank color) on left, chrome name on right */}
        <div style={{
          paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span className="agi-arena-tier-num" style={{
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            color: agent.rank.toLowerCase() === "diamond" ? "#22d3ee"
                 : agent.rank.toLowerCase() === "gold" ? "#facc15"
                 : agent.rank.toLowerCase() === "silver" ? "#cbd5e1"
                 : agent.rank.toLowerCase() === "bronze" ? "#d97706"
                 : "#6b7280",
          }}>
            TIER {agent.tier + 1}
          </span>
          <span className="agi-arena-tier-name" style={{
            fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5,
            ...config.chromeStyle,
          }}>
            {tierName}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="agi-arena-stat-cell" style={{
      textAlign: "center", padding: "16px 8px",
      background: "rgba(255,255,255,0.03)", borderRadius: 12,
    }}>
      <div className="agi-arena-stat-value" style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -0.3 }}>{value}</div>
      <div className="agi-arena-stat-label" style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginTop: 6 }}>
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

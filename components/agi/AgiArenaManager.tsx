"use client";

// Arena management surface — agent cards rendered in the SAME visual style
// as the public /arena modal cards (multi-stop chrome gradients on rank pills
// + avatar block, glow under the card, ELO/position pills, 3-stat grid,
// chrome-text TIER footer). Real data (no marketing overrides). No winrate,
// no streak.
//
// Source: /api/agents/rankings.

import { useEffect, useState, useCallback } from "react";
import { Trophy, RefreshCw, Loader2, ExternalLink, Search, Crown, Flame, Shield, Lock, Plus, X, Save, Lock as LockIcon, type LucideIcon } from "lucide-react";

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
  revenue: number;       // resolved by API (override or gross_revenue fallback)
  reach?: number;        // resolved by API (override or activities+campaigns)
  rating?: number;       // 0-5 stars, admin-editable per business
  website?: string | null;
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

// 5 tiers ending at TIER 5 / Ultimate Power. tier column stored 0-4,
// display label is `TIER {tier+1}`.
const TIER_NAMES: Record<number, string> = {
  0: "Apprentice", 1: "Master", 2: "Royal", 3: "Empire", 4: "Ultimate Power",
};
// Value / reach / rating are now stored in profiles.arena_value_override,
// profiles.arena_reach_override, profiles.arena_rating — the rankings
// endpoint resolves them and emits the final numbers on each agent. No
// more hardcoded business-name lookups in the UI.

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(Math.round(n));
}

function formatRating(rating: number | undefined): string {
  return (rating ?? 0).toFixed(1);
}

export function AgiArenaManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // agent id, or "new"

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
          <button
            onClick={() => setEditing("new")}
            style={{
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              border: "none", color: "#000",
              padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={13} /> Add Agent
          </button>
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
            {filtered.map(a => (
              <AgentCard key={a.id} agent={a} onClick={() => setEditing(a.id)} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AgentEditPanel
          agentId={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function AgentCard({ agent, onClick }: { agent: Agent; onClick?: () => void }) {
  const config = RANK_CONFIG[agent.rank.toLowerCase()] ?? RANK_CONFIG.unranked;
  const Icon = config.icon;
  // Override resolution moved to the rankings API — agent.revenue/.reach
  // already reflect the per-business arena_value_override / arena_reach_override
  // (or fallback to computed). Same for agent.rating.
  const value = agent.revenue ?? 0;
  const reach = agent.reach ?? (agent.activities + agent.campaigns);
  const isActive = agent.agentStatus === "active";
  const tierName = TIER_NAMES[agent.tier] ?? `Tier ${agent.tier + 1}`;

  return (
    <div style={{ position: "relative" }} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}>
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
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s, border-color 0.15s",
      }}
        onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-2px)"; } }}
        onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = "translateY(0)"; } }}
      >
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
              <span style={{ color: "#facc15" }}>&#9733;</span> {formatRating(agent.rating)}
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
            textTransform: "uppercase",
            ...config.chromeStyle,
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

// ── Agent Edit Panel ──────────────────────────────────────────────────────
// Slide-over modal for create + edit. Public fields (agent name, tier,
// premium flag, status) and Confidential fields (business, owner/admin,
// email, phone) are split into separate sections so it's clear at a glance
// what visitors see vs. what's admin-only.

interface ProfileFull {
  id?: string;
  agent_name?: string | null;
  business_name?: string | null;
  business_id?: string | null;  // FK to omni_businesses
  name?: string | null;       // owner / admin
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  tier?: number;
  crm_status?: string | null;
  lead_score?: string | null;
  is_premium?: boolean;
  agent_status?: string | null;
  elo_rating?: number;
  gross_revenue?: number;
  newsletter_subscribed?: boolean;
  // Editable arena card overrides (admin-set per business)
  arena_value_override?: number | null;
  arena_reach_override?: number | null;
  arena_rating?: number | null;
  website?: string | null;
}

interface BusinessOption {
  id: string;
  name: string;
}

function AgentEditPanel({
  agentId,
  onClose,
  onSaved,
}: {
  agentId: string | null;       // null = create new
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = agentId === null;
  const [form, setForm] = useState<ProfileFull>({
    agent_name: "", business_name: "", business_id: null, name: "", email: "", phone: "",
    role: "owner", tier: 0, crm_status: "lead", lead_score: "warm",
    is_premium: false, agent_status: "active",
    elo_rating: 1000, gross_revenue: 0, newsletter_subscribed: false,
    arena_value_override: null, arena_reach_override: null, arena_rating: 0,
    website: "",
  });
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const authHeader = (): HeadersInit => {
    if (typeof window === "undefined") return {};
    const t = localStorage.getItem("omni_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // Load full profile when editing
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/agents/admin?id=${agentId}`, { headers: authHeader() });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!cancelled && d.agent) setForm(d.agent);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load agent");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, isNew]);

  // Load business options for the FK dropdown
  useEffect(() => {
    fetch("/api/agi/businesses/advancement", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { businesses: [] })
      .then(d => {
        const opts: BusinessOption[] = (d.businesses ?? []).map((b: { business_id: string; business_name: string }) => ({
          id: b.business_id, name: b.business_name,
        }));
        setBusinesses(opts);
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof ProfileFull>(key: K, value: ProfileFull[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/agents/admin", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(isNew ? form : { id: agentId, ...form }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "flex-end" }}
    >
      <style jsx global>{`
        @media (max-width: 640px) {
          /* Edit agent panel — let the Row 2-up fields stack on phones so
             inputs aren't cramped, shrink section + outer padding so content
             actually fits a 360px viewport. */
          .agi-edit-panel {
            padding: 18px !important;
            gap: 14px !important;
          }
          .agi-edit-panel .agi-edit-section {
            padding: 14px !important;
            gap: 10px !important;
          }
          .agi-edit-panel .agi-edit-row {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .agi-edit-panel input,
          .agi-edit-panel select,
          .agi-edit-panel textarea {
            font-size: 14px !important; /* >=14px stops iOS auto-zoom */
            padding: 10px 12px !important;
          }
          .agi-edit-panel .agi-edit-footer {
            flex-direction: column-reverse !important;
            gap: 8px !important;
          }
          .agi-edit-panel .agi-edit-footer > button {
            width: 100% !important;
          }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="agi-edit-panel"
        style={{
          width: 540, maxWidth: "100%", height: "100%", overflowY: "auto",
          background: "#0c0c0c", borderLeft: "1px solid #1e1e1e",
          padding: 28, display: "flex", flexDirection: "column", gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>
              {isNew ? "Add new agent" : "Edit agent"}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>
              {isNew ? "Creates a row in profiles + ranks it in the arena" : `ID: ${agentId?.slice(0, 8)}…`}
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {err && (
          <div style={{ padding: 12, background: "#2a0d0d", border: "1px solid #f8717140", color: "#f87171", borderRadius: 8, fontSize: 12 }}>
            {err}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#444" }}>
            <Loader2 size={20} className="animate-spin" style={{ display: "inline-block" }} /> Loading…
          </div>
        ) : (
          <>
            {/* ── PUBLIC INFORMATION ── */}
            <Section title="Public information" subtitle="Visible on the public arena page">
              <Field label="Agent name">
                <input value={form.agent_name ?? ""} onChange={e => set("agent_name", e.target.value)} style={inp} placeholder="e.g. Alfred Belvedere" />
              </Field>
              <Row>
                <Field label="Tier">
                  <select
                    value={form.tier ?? 0}
                    onChange={e => set("tier", Number(e.target.value))}
                    style={inp}
                  >
                    <option value={0}>TIER 1 · Apprentice</option>
                    <option value={1}>TIER 2 · Master</option>
                    <option value={2}>TIER 3 · Royal</option>
                    <option value={3}>TIER 4 · Empire</option>
                    <option value={4}>TIER 5 · Ultimate Power</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.agent_status ?? "active"} onChange={e => set("agent_status", e.target.value)} style={inp}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="inactive">inactive</option>
                  </select>
                </Field>
              </Row>
              <Field label="Premium agent">
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
                  <input type="checkbox" checked={!!form.is_premium} onChange={e => set("is_premium", e.target.checked)} />
                  Show PREMIUM crown badge on the public card
                </label>
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  value={form.website ?? ""}
                  onChange={e => set("website", e.target.value)}
                  style={inp}
                  placeholder="https://example.com"
                />
              </Field>

              {/* Arena card stat overrides */}
              <div style={{
                marginTop: 6, paddingTop: 14, borderTop: "1px dashed #2a2a2a",
                fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
              }}>Arena card stats</div>
              <Row>
                <Field label="Value ($)">
                  <input
                    type="number" step="0.01"
                    value={form.arena_value_override ?? ""}
                    onChange={e => set("arena_value_override", e.target.value === "" ? null : Number(e.target.value))}
                    style={inp}
                    placeholder="e.g. 28000"
                  />
                </Field>
                <Field label="Rating (0–5)">
                  <input
                    type="number" step="0.1" min={0} max={5}
                    value={form.arena_rating ?? ""}
                    onChange={e => set("arena_rating", e.target.value === "" ? null : Number(e.target.value))}
                    style={inp}
                    placeholder="e.g. 5.0"
                  />
                </Field>
              </Row>
              <Field label="Reach">
                <input
                  type="number"
                  value={form.arena_reach_override ?? ""}
                  onChange={e => set("arena_reach_override", e.target.value === "" ? null : Number(e.target.value))}
                  style={inp}
                  placeholder="e.g. 1111 (subscribers + reach)"
                />
              </Field>
            </Section>

            {/* ── PERFORMANCE ── */}
            <Section title="Performance" subtitle="Ranking signals — most fields are also computed automatically">
              <Row>
                <Field label="ELO rating">
                  <input type="number" value={form.elo_rating ?? 1000} onChange={e => set("elo_rating", Number(e.target.value))} style={inp} />
                </Field>
                <Field label="Lead score">
                  <select value={form.lead_score ?? "warm"} onChange={e => set("lead_score", e.target.value)} style={inp}>
                    <option value="hot">hot</option>
                    <option value="warm">warm</option>
                    <option value="cold">cold</option>
                  </select>
                </Field>
              </Row>
              <Row>
                <Field label="CRM status">
                  <select value={form.crm_status ?? "lead"} onChange={e => set("crm_status", e.target.value)} style={inp}>
                    <option value="lead">lead</option>
                    <option value="prospect">prospect</option>
                    <option value="client">client</option>
                  </select>
                </Field>
                <Field label="Gross revenue ($)">
                  <input type="number" step="0.01" value={form.gross_revenue ?? 0} onChange={e => set("gross_revenue", Number(e.target.value))} style={inp} />
                </Field>
              </Row>
            </Section>

            {/* ── CONFIDENTIAL INFORMATION ── */}
            <Section
              title="Confidential information"
              subtitle="Admin-only. Never displayed on the public arena page."
              confidential
            >
              <Field label="Linked business (pipeline tenant)">
                <select
                  value={form.business_id ?? ""}
                  onChange={e => set("business_id", e.target.value || null)}
                  style={inp}
                >
                  <option value="">— Auto-link from business name —</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Business name">
                <input value={form.business_name ?? ""} onChange={e => set("business_name", e.target.value)} style={inp} placeholder="e.g. Omni AI" />
              </Field>
              <Field label="Admin / owner name">
                <input value={form.name ?? ""} onChange={e => set("name", e.target.value)} style={inp} placeholder="e.g. Sitani Mafi" />
              </Field>
              <Row>
                <Field label="Email">
                  <input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} style={inp} />
                </Field>
                <Field label="Phone">
                  <input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} style={inp} />
                </Field>
              </Row>
              <Field label="Role">
                <input value={form.role ?? ""} onChange={e => set("role", e.target.value)} style={inp} placeholder="owner / agent / admin" />
              </Field>
            </Section>

            {/* Footer actions */}
            <div className="agi-edit-footer" style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 16, borderTop: "1px solid #1e1e1e" }}>
              <button onClick={onClose} style={{ ...iconBtn, flex: 1, justifyContent: "center", padding: "11px 14px", fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} style={{
                flex: 2, justifyContent: "center",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff", border: "none",
                padding: "11px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isNew ? "Create agent" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, confidential, children }: { title: string; subtitle?: string; confidential?: boolean; children: React.ReactNode }) {
  return (
    <div className="agi-edit-section" style={{
      background: confidential ? "linear-gradient(135deg, #1a0d0d 0%, #0d0d0d 100%)" : "#111",
      border: `1px solid ${confidential ? "#f8717130" : "#1e1e1e"}`,
      borderRadius: 12, padding: 18,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7,
          color: confidential ? "#f87171" : "#a78bfa",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {confidential && <LockIcon size={11} />}
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="agi-edit-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>;
}

const inp: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  color: "#e8e8e8",
  padding: "9px 12px",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

const iconBtn: React.CSSProperties = {
  background: "#191919",
  border: "1px solid #2a2a2a",
  color: "#cbd5e1",
  padding: "8px 10px",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
};

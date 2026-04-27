"use client";

// Arena management surface for the agentic dashboard.
// Plain list of agents in the arena — name, owner, tier rank, ELO, W/L
// record + winrate + streak + revenue. No marketing chrome.
//
// Data source: /api/agents/rankings — same as the public /arena page.

import { useEffect, useState, useCallback } from "react";
import { Trophy, RefreshCw, Loader2, ExternalLink, Search, Crown, Flame, Activity } from "lucide-react";

interface Agent {
  id: string;
  agentName: string;
  businessName: string | null;
  ownerName: string | null;
  rank: string;          // "rookie" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master"
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  avatar: string | null;
  tier: number;
  isPremium: boolean;
  crmStatus: string | null;
  revenue: number;
  reach: number;
  campaigns: number;
  activities: number;
  agentStatus: string;
  createdAt: string;
  leaderboardPosition: number;
}

const RANK_COLOR: Record<string, string> = {
  master: "#facc15",
  diamond: "#38bdf8",
  platinum: "#a78bfa",
  gold: "#f59e0b",
  silver: "#94a3b8",
  bronze: "#b45309",
  rookie: "#666",
};

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

      {/* Agent list */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(a => {
              const rankColor = RANK_COLOR[(a.rank ?? "rookie").toLowerCase()] ?? "#666";
              const top3 = a.leaderboardPosition <= 3;
              return (
                <div key={a.id} style={{
                  background: "#111", border: `1px solid ${top3 ? `${rankColor}40` : "#1e1e1e"}`, borderRadius: 10,
                  padding: 14, display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 14, alignItems: "center",
                }}>
                  {/* Position badge */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: top3 ? `${rankColor}22` : "#0a0a0a",
                    border: top3 ? `1.5px solid ${rankColor}` : "1px solid #222",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {top3 && a.leaderboardPosition === 1 ? (
                      <Crown size={14} color={rankColor} />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: top3 ? rankColor : "#94a3b8" }}>
                        #{a.leaderboardPosition}
                      </span>
                    )}
                  </div>

                  {/* Body — name, business, rank, ELO, W/L, streak */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word" }}>{a.agentName}</div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: rankColor, background: `${rankColor}18`,
                        padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5,
                      }}>
                        {a.rank}
                      </span>
                      {a.isPremium && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: "#facc15", background: "#facc1518",
                          padding: "3px 8px", borderRadius: 4,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          <Crown size={10} /> PREMIUM
                        </span>
                      )}
                    </div>
                    {(a.businessName || a.ownerName) && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                        {[a.businessName, a.ownerName].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#666", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>ELO <strong style={{ color: "#cbd5e1" }}>{a.elo}</strong></span>
                      <span>
                        <span style={{ color: "#10b981" }}>{a.wins}W</span> ·{" "}
                        <span style={{ color: "#f87171" }}>{a.losses}L</span>
                      </span>
                      <span>{a.winRate.toFixed(1)}% winrate</span>
                      {a.streak > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#fb923c" }}>
                          <Flame size={11} /> {a.streak} streak
                        </span>
                      )}
                      {a.activities > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Activity size={11} /> {a.activities}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                      color: a.agentStatus === "active" ? "#10b981" : "#666",
                      background: a.agentStatus === "active" ? "#0d2a1e" : "#1a1a1a",
                      border: `1px solid ${a.agentStatus === "active" ? "#10b98140" : "#222"}`,
                      padding: "3px 8px", borderRadius: 4,
                    }}>
                      {a.agentStatus}
                    </span>
                    {a.revenue > 0 && (
                      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                        ${a.revenue.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

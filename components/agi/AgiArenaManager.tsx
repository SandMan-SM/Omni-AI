"use client";

// Arena management surface for the agentic dashboard.
// Plain list of agents in the arena — name, tier, ELO, W/L/D record. No
// marketing chrome, no leaderboard widget, no ranking tier explainer. Just
// the agents.
//
// Data source: `/api/agents/rankings` — same as the public /arena page.

import { useEffect, useState, useCallback } from "react";
import { Trophy, RefreshCw, Loader2, ExternalLink, Search } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  slug?: string;
  rank?: number;
  tier?: string;
  elo?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  badges?: string[];
}

const TIER_COLOR: Record<string, string> = {
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

  const filtered = search.trim()
    ? agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #f59e0b, #f97316)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Trophy size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Arena Agents</div>
            <div style={{ fontSize: 11, color: "#666" }}>
              {loading ? "Loading…" : `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`}
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
            placeholder="Search agents by name…"
            style={{ background: "transparent", border: "none", outline: "none", color: "#e8e8e8", fontSize: 13, flex: 1 }}
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
            {filtered.map((a, i) => {
              const tierColor = TIER_COLOR[(a.tier ?? "rookie").toLowerCase()] ?? "#666";
              const winRate = a.wins != null && a.losses != null
                ? Math.round((a.wins / Math.max(1, a.wins + a.losses + (a.draws ?? 0))) * 100)
                : null;
              return (
                <div key={a.id ?? i} style={{
                  background: "#111", border: "1px solid #1e1e1e", borderRadius: 10,
                  padding: 14, display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 14, alignItems: "center",
                }}>
                  {/* Rank badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: a.rank && a.rank <= 3 ? `${tierColor}22` : "#0a0a0a",
                    border: a.rank && a.rank <= 3 ? `1.5px solid ${tierColor}` : "1px solid #222",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: a.rank && a.rank <= 3 ? tierColor : "#94a3b8",
                    flexShrink: 0,
                  }}>
                    {a.rank ?? "—"}
                  </div>

                  {/* Name + tier + record */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word" }}>{a.name}</div>
                      {a.tier && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: tierColor, background: `${tierColor}18`,
                          padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5,
                        }}>
                          {a.tier}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {a.elo != null && <span>ELO <strong style={{ color: "#cbd5e1" }}>{a.elo}</strong></span>}
                      {a.wins != null && (
                        <span>
                          <span style={{ color: "#10b981" }}>{a.wins}W</span> ·{" "}
                          <span style={{ color: "#f87171" }}>{a.losses ?? 0}L</span>
                          {a.draws != null && a.draws > 0 && <> · <span style={{ color: "#94a3b8" }}>{a.draws}D</span></>}
                        </span>
                      )}
                      {winRate != null && <span>{winRate}% winrate</span>}
                    </div>
                  </div>

                  {/* Open public profile */}
                  {a.slug && (
                    <a
                      href={`/arena/${a.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: "#0a0a0a", border: "1px solid #1e1e1e", color: "#94a3b8",
                        padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        textDecoration: "none",
                        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                      }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
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

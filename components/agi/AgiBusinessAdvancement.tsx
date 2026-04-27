"use client";

// Per-business advancement panel — one card per dashboard business with
// pipeline KPIs (leads, conversions, meetings, growth) and an "advancement
// score" 0–100 that's a composite signal of recent growth.
//
// Mounted at the top of the Companies tab + standalone view. Reads from
// /api/agi/businesses/advancement which queries the omni_business_advancement
// view.

import { useEffect, useState, useCallback } from "react";
import {
  Building2, TrendingUp, Target, Award, Calendar, RefreshCw, Loader2,
  Crown, Mail, ArrowUpRight, Activity, ChevronDown, ChevronRight, Plus, X,
} from "lucide-react";

interface BusinessAdvancement {
  business_id: string;
  business_name: string;
  plan: string;
  industry: string | null;
  location: string | null;
  business_created_at: string;
  leads_total: number;
  leads_open: number;
  leads_converted: number;
  leads_added_7d: number;
  leads_added_30d: number;
  avg_lead_score: number;
  revenue_from_leads: number;
  last_lead_activity: string | null;
  meetings_total: number;
  meetings_upcoming: number;
  meetings_completed: number;
  meetings_cancelled: number;
  next_meeting: string | null;
  profiles_count: number;
  profiles_revenue: number;
  admin_name: string | null;
  admin_email: string | null;
  advancement_score: number;
}

const PLAN_COLOR: Record<string, string> = {
  starter:    "#10b981",
  pro:        "#818cf8",
  enterprise: "#fb923c",
};

function scoreColor(s: number): string {
  if (s >= 70) return "#10b981";   // healthy growth
  if (s >= 30) return "#facc15";   // some traction
  return "#666";                    // dormant
}

function scoreLabel(s: number): string {
  if (s >= 70) return "Advancing";
  if (s >= 30) return "Building";
  return "Dormant";
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function AgiBusinessAdvancement() {
  const [list, setList] = useState<BusinessAdvancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/agi/businesses/advancement", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setList(d.businesses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load advancement data");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="agi-advancement-root" style={{
      background: "linear-gradient(135deg, #0d2a1e 0%, #0d0d0d 60%)",
      border: "1px solid #10b98140",
      borderRadius: 14, padding: 18, marginBottom: 16,
      color: "#e8e8e8", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style jsx global>{`
        @media (max-width: 720px) {
          .agi-advancement-root .agi-advancement-grid {
            grid-template-columns: 1fr !important;
          }
          .agi-advancement-root .agi-advancement-card {
            padding: 14px !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #10b981, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Business Advancement</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {loading ? "Loading…" : `${list.length} ${list.length === 1 ? "business" : "businesses"} · sorted by growth`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setOnboarding(true)} style={{
            background: "linear-gradient(135deg, #10b981, #818cf8)", border: "none", color: "#fff",
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={12} /> Onboard business
          </button>
          <button onClick={load} disabled={loading} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1",
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
      </div>

      {onboarding && (
        <OnboardModal onClose={() => setOnboarding(false)} onCreated={() => { setOnboarding(false); load(); }} />
      )}

      {error && (
        <div style={{ padding: 12, background: "#2a0d0d", border: "1px solid #f8717140", color: "#f87171", fontSize: 12, borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#444", fontSize: 13 }}>
          <Loader2 size={18} className="animate-spin" style={{ display: "inline-block" }} /> Loading…
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#444", fontSize: 13 }}>
          No businesses yet. Sign up clients to see advancement here.
        </div>
      ) : (
        <div className="agi-advancement-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
        }}>
          {list.map(b => <BizCard key={b.business_id} biz={b} />)}
        </div>
      )}
    </div>
  );
}

interface ActivityEvent {
  business_id: string;
  event_type: "lead_created" | "meeting_booked" | "profile_joined";
  event_id: string;
  event_subject: string;
  event_summary: string;
  event_at: string;
}

const EVENT_COLOR: Record<string, string> = {
  lead_created:   "#818cf8",
  meeting_booked: "#10b981",
  profile_joined: "#facc15",
};

function BizCard({ biz }: { biz: BusinessAdvancement }) {
  const sc = scoreColor(biz.advancement_score);
  const planColor = PLAN_COLOR[biz.plan] ?? "#94a3b8";
  const conversionPct = biz.leads_total > 0
    ? Math.round((biz.leads_converted / biz.leads_total) * 100)
    : 0;
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!expanded || events.length > 0) return;
    setLoadingEvents(true);
    fetch(`/api/agi/businesses/activity?business_id=${biz.business_id}&limit=8`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setEvents(d.events ?? []))
      .finally(() => setLoadingEvents(false));
  }, [expanded, events.length, biz.business_id]);

  return (
    <div className="agi-advancement-card" style={{
      background: "rgba(0,0,0,0.4)", border: `1px solid ${sc}30`,
      borderRadius: 12, padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
      position: "relative",
    }}>
      {/* Header row: name + plan + advancement score */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Building2 size={14} color={sc} />
            <div style={{ fontSize: 14, fontWeight: 700, wordBreak: "break-word" }}>{biz.business_name}</div>
            <span style={{
              fontSize: 9, fontWeight: 700, color: planColor, background: `${planColor}18`,
              padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5,
            }}>{biz.plan}</span>
          </div>
          {(biz.industry || biz.location) && (
            <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>
              {[biz.industry, biz.location].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 999,
            fontSize: 11, fontWeight: 700,
            color: sc, background: `${sc}18`, border: `1px solid ${sc}40`,
          }}>
            <ArrowUpRight size={11} />
            {biz.advancement_score}
          </div>
          <div style={{ fontSize: 9, color: sc, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
            {scoreLabel(biz.advancement_score)}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <Kpi icon={Target} label="Leads" value={biz.leads_total} sub={`${biz.leads_open} open`} color="#818cf8" />
        <Kpi icon={Award} label="Converted" value={biz.leads_converted} sub={`${conversionPct}% rate`} color="#10b981" />
        <Kpi icon={Activity} label="7d" value={`+${biz.leads_added_7d}`} sub={`+${biz.leads_added_30d} 30d`} color="#facc15" />
      </div>

      {/* Meetings + revenue row */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.03)", borderRadius: 8,
        fontSize: 11, color: "#94a3b8",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Calendar size={12} />
          {biz.meetings_upcoming} upcoming · {biz.meetings_completed} done
        </span>
        <span style={{ color: "#10b981", fontWeight: 700 }}>
          ${(biz.revenue_from_leads ?? 0).toLocaleString()}
        </span>
      </div>

      {/* Footer: admin + last activity + expand toggle */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 10, color: "#666",
        borderTop: "1px dashed #1e1e1e", paddingTop: 10, gap: 8, flexWrap: "wrap",
      }}>
        {biz.admin_email ? (
          <a href={`mailto:${biz.admin_email}`} style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Crown size={10} /> {biz.admin_name ?? biz.admin_email}
          </a>
        ) : <span style={{ fontStyle: "italic" }}>No admin linked</span>}
        <span>Last activity: {fmtRelative(biz.last_lead_activity)}</span>
      </div>

      {/* Activity expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: "transparent", border: "none", color: "#94a3b8",
          cursor: "pointer", fontSize: 11, fontWeight: 600,
          padding: "4px 0",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {expanded ? "Hide activity" : "View recent activity"}
      </button>

      {expanded && (
        <div style={{
          background: "rgba(0,0,0,0.4)", border: "1px solid #1e1e1e",
          borderRadius: 8, padding: 10,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {loadingEvents ? (
            <div style={{ padding: 14, textAlign: "center", color: "#444", fontSize: 11 }}>
              <Loader2 size={12} className="animate-spin" style={{ display: "inline-block" }} /> Loading…
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: 14, textAlign: "center", color: "#444", fontSize: 11, fontStyle: "italic" }}>
              No recent activity
            </div>
          ) : (
            events.map(ev => {
              const c = EVENT_COLOR[ev.event_type] ?? "#94a3b8";
              return (
                <div key={`${ev.event_type}-${ev.event_id}`} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 11,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: c, flexShrink: 0,
                    boxShadow: `0 0 6px ${c}80`,
                  }} />
                  <span style={{ color: "#cbd5e1", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {ev.event_subject}
                  </span>
                  <span style={{ color: "#666", flexShrink: 0 }}>
                    {ev.event_summary}
                  </span>
                  <span style={{ color: "#444", flexShrink: 0, fontSize: 10 }}>
                    {fmtRelative(ev.event_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "9px 8px",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
        <Icon size={10} color={color} />
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#555" }}>{sub}</div>}
    </div>
  );
}

// ── Onboard new business modal ────────────────────────────────────────────
function OnboardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const auth = (): HeadersInit => {
    if (typeof window === "undefined") return {};
    const t = localStorage.getItem("omni_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  async function submit() {
    if (!name.trim()) { setErr("Business name required"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/agi/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify({ name: name.trim(), plan, industry, location, contact_email: contactEmail, website }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, maxWidth: "100%",
        background: "#0c0c0c", border: "1px solid #10b98140",
        borderRadius: 14, padding: 22,
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Onboard new business</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>Creates a tenant in omni_businesses with its own pipeline.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {err && <div style={{ padding: 10, background: "#2a0d0d", border: "1px solid #f8717140", color: "#f87171", fontSize: 12, borderRadius: 8 }}>{err}</div>}

        <Lbl label="Business name *">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" style={modalInp} autoFocus />
        </Lbl>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Lbl label="Plan">
            <select value={plan} onChange={e => setPlan(e.target.value as never)} style={modalInp}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Lbl>
          <Lbl label="Industry">
            <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Roofing" style={modalInp} />
          </Lbl>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Lbl label="Location">
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Salt Lake City, UT" style={modalInp} />
          </Lbl>
          <Lbl label="Contact email">
            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="owner@example.com" style={modalInp} />
          </Lbl>
        </div>
        <Lbl label="Website">
          <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" style={modalInp} />
        </Lbl>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "#191919", border: "1px solid #2a2a2a", color: "#cbd5e1",
            padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={submit} disabled={busy || !name.trim()} style={{
            flex: 2,
            background: busy ? "#0d2a1e" : "linear-gradient(135deg, #10b981, #818cf8)",
            border: "none", color: "#fff",
            padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: busy || !name.trim() ? "not-allowed" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: !name.trim() ? 0.5 : 1,
          }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create business
          </button>
        </div>
      </div>
    </div>
  );
}

function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 140 }}>
      <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const modalInp: React.CSSProperties = {
  background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#e8e8e8",
  padding: "9px 12px", borderRadius: 8, fontSize: 14, fontFamily: "inherit",
  outline: "none", width: "100%",
};

"use client";

// Shared slide-over editor for a `profiles` row (an arena agent / dashboard
// client). Used from:
//   • /assets → AgiArenaManager (Edit / Add Agent buttons on the cards)
//   • /dashboard/leads → LeadPanel (Edit full profile button when the lead
//     was synced from a profile row).
//
// Public + Performance + Confidential sections — every editable field on
// `profiles` including the arena card overrides (tier, value/rating/reach,
// website, premium flag) and the linked-business FK.

import { useEffect, useState } from "react";
import { Loader2, X, Save, Lock as LockIcon } from "lucide-react";

export interface ProfileFull {
  id?: string;
  agent_name?: string | null;
  username?: string | null;       // Telegram-style handle / public alias
  business_name?: string | null;
  business_id?: string | null;    // FK to omni_businesses
  name?: string | null;           // owner / admin
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
  // Sponsor program flags
  is_sponsor?: boolean;
  sponsor_tier?: string | null;       // 'standard' | 'vip' | 'platinum' | null
  sponsor_activated?: boolean;
  sponsor_insights_paid?: boolean;
}

export interface BusinessOption {
  id: string;
  name: string;
}

export function AgentEditPanel({
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
    agent_name: "", username: "", business_name: "", business_id: null, name: "", email: "", phone: "",
    role: "owner", tier: 0, crm_status: "lead", lead_score: "warm",
    is_premium: false, agent_status: "active",
    elo_rating: 1000, gross_revenue: 0, newsletter_subscribed: false,
    arena_value_override: null, arena_reach_override: null, arena_rating: 0,
    website: "",
    is_sponsor: false, sponsor_tier: null, sponsor_activated: false, sponsor_insights_paid: false,
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
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "flex-end" }}
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
              <Row>
                <Field label="Agent name">
                  <input value={form.agent_name ?? ""} onChange={e => set("agent_name", e.target.value)} style={inp} placeholder="e.g. Alfred Belvedere" />
                </Field>
                <Field label="Username / handle">
                  <input
                    value={form.username ?? ""}
                    onChange={e => set("username", e.target.value)}
                    style={inp}
                    placeholder="e.g. Fray, $Mafi, fred_omni"
                  />
                </Field>
              </Row>
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

            {/* ── SPONSOR STATUS ── */}
            <Section title="Sponsor status" subtitle="Sponsor flag drives the SPONSOR badge across the agentic dashboard.">
              <Field label="Sponsor">
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
                  <input type="checkbox" checked={!!form.is_sponsor} onChange={e => set("is_sponsor", e.target.checked)} />
                  This person is a sponsor
                </label>
              </Field>
              <Row>
                <Field label="Sponsor tier">
                  <select
                    value={form.sponsor_tier ?? ""}
                    onChange={e => set("sponsor_tier", e.target.value || null)}
                    style={inp}
                    disabled={!form.is_sponsor}
                  >
                    <option value="">— None —</option>
                    <option value="standard">Standard</option>
                    <option value="vip">VIP</option>
                    <option value="platinum">Platinum</option>
                  </select>
                </Field>
                <Field label="Activated">
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1", paddingTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={!!form.sponsor_activated}
                      disabled={!form.is_sponsor}
                      onChange={e => set("sponsor_activated", e.target.checked)}
                    />
                    Sponsorship activated
                  </label>
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

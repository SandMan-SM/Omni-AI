"use client";

// Agentic Assets — owner-only management surface for the platform's
// behind-the-scenes plumbing: prompts, models, scheduled tasks, scoring
// weights, secrets, integrations.
//
// Gate: only sitanim8@gmail.com / $Mafi can see this. Everyone else
// (including other admins) gets redirected away.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile } from "@/hooks/use-profile";
import {
  Sparkles, ArrowLeft, Key, Bot, Zap, Calendar, Database,
  ExternalLink, Lock, RefreshCw, Loader2,
} from "lucide-react";

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const SCHEDULED_TASKS = [
  { id: "omni-ai-business-advancement-digest", label: "Daily advancement digest", schedule: "8:00 AM daily", endpoint: "/api/agi/businesses/digest" },
  { id: "omni-ai-hot-lead-scanner",            label: "Hot-lead scanner",         schedule: "Every 4 hours",  endpoint: "/api/agi/leads/hot-lead-alerts" },
  { id: "omni-ai-strategic-insights",          label: "Strategic insights",       schedule: "Wed 9:00 AM",    endpoint: "/api/agi/insights/strategic" },
  { id: "omni-ai-weekly-kpi-digest",           label: "Weekly KPI email",         schedule: "Mon 7:00 AM",    endpoint: "/api/agi/digest/weekly" },
];

const ENDPOINTS = [
  { group: "Pipeline & advancement", items: [
    { name: "Today's Focus",          path: "/api/agi/focus" },
    { name: "Business advancement",   path: "/api/agi/businesses/advancement" },
    { name: "Activity feed",          path: "/api/agi/businesses/activity" },
    { name: "Daily digest",           path: "/api/agi/businesses/digest" },
    { name: "Weekly digest email",    path: "/api/agi/digest/weekly" },
    { name: "Strategic insights",     path: "/api/agi/insights/strategic" },
  ]},
  { group: "Leads", items: [
    { name: "Hot-lead alerts",        path: "/api/agi/leads/hot-lead-alerts" },
    { name: "Bulk score",             path: "/api/agi/leads/bulk-score" },
    { name: "AI score (single)",      path: "/api/agi/leads/score-ai" },
    { name: "Status history",         path: "/api/agi/leads/history" },
    { name: "Activity log",           path: "/api/agi/leads/activity" },
    { name: "Duplicates",             path: "/api/agi/leads/duplicates" },
    { name: "Generate (web/apollo)",  path: "/api/agi/leads/generate" },
  ]},
  { group: "Companies & agents", items: [
    { name: "Auto-enrich queue",      path: "/api/agi/companies/auto-enrich" },
    { name: "Enrich (Apollo)",        path: "/api/agi/companies/enrich" },
    { name: "Agent rankings",         path: "/api/agents/rankings" },
    { name: "Agent admin",            path: "/api/agents/admin" },
  ]},
  { group: "Communication", items: [
    { name: "Telegram webhook",       path: "/api/agi/telegram/webhook" },
    { name: "Reply categorize",       path: "/api/agi/replies/categorize" },
    { name: "Reply draft",            path: "/api/agi/replies/draft" },
    { name: "Outreach send",          path: "/api/agi/outreach/send" },
    { name: "Meetings book",          path: "/api/agi/meetings/book" },
  ]},
];

export default function AssetsPage() {
  const router = useRouter();
  const { profile, profileLoading, isAdmin } = useProfile();
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const isMafi = !!profile && (
    (profile.name ?? "").trim() === "$Mafi" ||
    (profile.email ?? "").toLowerCase() === "sitanim8@gmail.com"
  );

  useEffect(() => {
    if (profileLoading) return;
    if (!profile || !isAdmin || !isMafi) {
      router.replace("/dashboard");
    }
  }, [profile, profileLoading, isAdmin, isMafi, router]);

  useEffect(() => {
    if (!isMafi) return;
    fetch("/api/agi/audit?limit=20", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setAudit(d.events ?? []))
      .finally(() => setAuditLoading(false));
  }, [isMafi]);

  if (profileLoading || !profile) {
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={20} className="animate-spin" color="#a78bfa" />
      </div>
    );
  }
  if (!isMafi) {
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ textAlign: "center" }}>
          <Lock size={32} color="#444" style={{ display: "inline-block", marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Owner-only surface</div>
          <div style={{ fontSize: 13, color: "#666" }}>Redirecting to dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e8e8e8", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <header style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "0 32px", height: 60, display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "#666", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: "#222" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="#a78bfa" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Agentic Assets</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.15)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Owner-only
          </span>
        </div>
      </header>

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>Agentic Assets</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "6px 0 0" }}>
            The plumbing behind the dashboard — scheduled tasks, API surfaces, audit log, and platform secrets.
          </p>
        </div>

        {/* Scheduled tasks */}
        <Section title="Scheduled tasks" icon={Calendar}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {SCHEDULED_TASKS.map(t => (
              <div key={t.id} style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{t.schedule}</div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>{t.endpoint}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* API endpoints */}
        <Section title="API surfaces" icon={Zap}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ENDPOINTS.map(g => (
              <div key={g.group}>
                <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 700, marginBottom: 8 }}>{g.group}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 6 }}>
                  {g.items.map(i => (
                    <a
                      key={i.path}
                      href={i.path}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        padding: "8px 12px", background: "#0a0a0a", border: "1px solid #1e1e1e",
                        borderRadius: 8, color: "#cbd5e1", textDecoration: "none", fontSize: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "#e8e8e8" }}>{i.name}</div>
                        <div style={{ fontSize: 10, color: "#666", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.path}</div>
                      </div>
                      <ExternalLink size={11} color="#444" style={{ flexShrink: 0 }} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Audit log */}
        <Section title="Recent admin actions" icon={Database}>
          {auditLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#444", fontSize: 12 }}>
              <Loader2 size={14} className="animate-spin" style={{ display: "inline-block" }} /> Loading…
            </div>
          ) : audit.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#444", fontSize: 12, fontStyle: "italic" }}>
              No admin actions logged yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {audit.map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6, fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
                  <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{e.action}</span>
                  {e.target_type && <span style={{ color: "#666" }}>· {e.target_type}</span>}
                  {typeof e.metadata?.name === 'string' && <span style={{ color: "#94a3b8" }}>· {String(e.metadata.name)}</span>}
                  <span style={{ marginLeft: "auto", color: "#444", fontSize: 10 }}>{new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Secrets / integrations status */}
        <Section title="Integrations" icon={Key}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            <IntegrationStatus name="Anthropic Claude" />
            <IntegrationStatus name="Resend (email)" />
            <IntegrationStatus name="Telegram bot" />
            <IntegrationStatus name="Apollo MCP" />
            <IntegrationStatus name="Stripe" />
            <IntegrationStatus name="Supabase" />
          </div>
        </Section>

        {/* Quick actions */}
        <Section title="Quick actions" icon={Bot}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            <ActionButton label="Fire daily digest now" endpoint="/api/agi/businesses/digest" method="POST" />
            <ActionButton label="Scan hot leads now" endpoint="/api/agi/leads/hot-lead-alerts" method="POST" />
            <ActionButton label="Generate strategic insights" endpoint="/api/agi/insights/strategic" method="POST" />
            <ActionButton label="Send weekly KPI email" endpoint="/api/agi/digest/weekly" method="POST" />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icon size={14} color="#a78bfa" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8, padding: 12,
};

function IntegrationStatus({ name }: { name: string }) {
  // We don't expose env-presence client-side; render placeholder dot.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.5)" }} />
      <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{name}</span>
    </div>
  );
}

function ActionButton({ label, endpoint, method }: { label: string; endpoint: string; method: "GET" | "POST" }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  async function fire() {
    setBusy(true); setResult(null);
    try {
      const r = await fetch(endpoint, { method });
      const j = await r.json();
      setResult(j.ok ? "✓ done" : `✗ ${j.error ?? "failed"}`);
    } catch (e) {
      setResult(`✗ ${e instanceof Error ? e.message : "failed"}`);
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 4000);
    }
  }
  return (
    <button
      onClick={fire}
      disabled={busy}
      style={{
        background: busy ? "#1a1a2e" : "#0a0a0a",
        border: "1px solid #a78bfa40",
        color: "#cbd5e1",
        padding: "10px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
        cursor: busy ? "wait" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
        textAlign: "left",
      }}
    >
      <span>{label}</span>
      {busy ? <Loader2 size={12} className="animate-spin" /> : result ? <span style={{ fontSize: 11, color: result.startsWith("✓") ? "#10b981" : "#f87171" }}>{result}</span> : <RefreshCw size={11} color="#666" />}
    </button>
  );
}

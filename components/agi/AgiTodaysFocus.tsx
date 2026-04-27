"use client";

// Today's Focus — single-card cross-business briefing of what to act on
// today: hot leads needing first contact, stuck leads needing a nudge,
// today's meetings, recent cancellations, recent conversions to celebrate.
// Pulls from /api/agi/focus.

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles, Flame, Clock, Calendar, CalendarX, PartyPopper,
  RefreshCw, Loader2, ChevronRight, Mail, Phone,
} from "lucide-react";
import Link from "next/link";

interface FocusLead {
  id: string;
  business_id: string | null;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email?: string | null;
  score?: number;
  status?: string;
  ai_recommended_angle?: string | null;
  updated_at?: string;
  deal_value?: number | null;
}

interface FocusMeeting {
  id: string;
  business_id: string | null;
  business_name: string | null;
  attendee_name: string;
  attendee_email: string;
  start_at: string;
  duration_minutes: number;
  meeting_type: string | null;
  lead?: { first_name: string | null; last_name: string | null } | null;
}

interface FocusPayload {
  today: string;
  hot_new_leads: FocusLead[];
  stuck_leads: FocusLead[];
  today_meetings: FocusMeeting[];
  recent_cancelled: FocusMeeting[];
  recent_conversions: FocusLead[];
}

function leadName(l: FocusLead): string {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company || l.email || "Unknown";
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function AgiTodaysFocus() {
  const [data, setData] = useState<FocusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/agi/focus", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = (data?.hot_new_leads.length ?? 0)
    + (data?.stuck_leads.length ?? 0)
    + (data?.today_meetings.length ?? 0)
    + (data?.recent_cancelled.length ?? 0)
    + (data?.recent_conversions.length ?? 0);

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(56,189,248,0.04) 50%, rgba(16,185,129,0.06) 100%)",
      border: "1px solid #a78bfa30",
      borderRadius: 14, padding: 18,
      color: "#e8e8e8", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #a78bfa, #38bdf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Today&apos;s Focus</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {loading ? "Loading…" : total === 0 ? "All caught up · nothing pressing" : `${total} item${total === 1 ? "" : "s"} to handle today`}
            </div>
          </div>
        </div>
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

      {error && (
        <div style={{ padding: 12, background: "#2a0d0d", border: "1px solid #f8717140", color: "#f87171", fontSize: 12, borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!loading && data && total === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>
          🌟 No urgent items — your pipeline is clean. Run the agent to generate fresh leads.
        </div>
      )}

      {!loading && data && total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {data.hot_new_leads.length > 0 && (
            <FocusSection title="Hot leads · first contact" icon={Flame} color="#fb923c" count={data.hot_new_leads.length}>
              {data.hot_new_leads.map(l => (
                <FocusRow
                  key={l.id}
                  primary={leadName(l)}
                  secondary={[l.business_name, `${l.score} score`].filter(Boolean).join(" · ")}
                  hint={l.ai_recommended_angle ?? undefined}
                  href={`/dashboard/leads?lead=${l.id}`}
                />
              ))}
            </FocusSection>
          )}

          {data.today_meetings.length > 0 && (
            <FocusSection title="Today's meetings" icon={Calendar} color="#10b981" count={data.today_meetings.length}>
              {data.today_meetings.map(m => (
                <FocusRow
                  key={m.id}
                  primary={[m.lead?.first_name, m.lead?.last_name].filter(Boolean).join(" ") || m.attendee_name}
                  secondary={`${fmtTime(m.start_at)} · ${m.duration_minutes}m · ${m.business_name ?? ""}`}
                  href="/dashboard/meetings"
                />
              ))}
            </FocusSection>
          )}

          {data.stuck_leads.length > 0 && (
            <FocusSection title="Stuck leads · need a nudge" icon={Clock} color="#facc15" count={data.stuck_leads.length}>
              {data.stuck_leads.map(l => (
                <FocusRow
                  key={l.id}
                  primary={leadName(l)}
                  secondary={`${l.business_name ?? ""} · idle ${fmtRelative(l.updated_at)}`}
                  hint={`Last status: ${l.status}`}
                  href={`/dashboard/leads?lead=${l.id}`}
                />
              ))}
            </FocusSection>
          )}

          {data.recent_cancelled.length > 0 && (
            <FocusSection title="Recently cancelled" icon={CalendarX} color="#f87171" count={data.recent_cancelled.length}>
              {data.recent_cancelled.map(m => (
                <FocusRow
                  key={m.id}
                  primary={m.attendee_name}
                  secondary={`${m.business_name ?? ""} · ${fmtRelative(m.start_at)}`}
                  hint={`Reschedule: mailto:${m.attendee_email}`}
                  href="/dashboard/meetings"
                />
              ))}
            </FocusSection>
          )}

          {data.recent_conversions.length > 0 && (
            <FocusSection title="Wins · last 24h" icon={PartyPopper} color="#10b981" count={data.recent_conversions.length}>
              {data.recent_conversions.map(l => (
                <FocusRow
                  key={l.id}
                  primary={leadName(l)}
                  secondary={[l.business_name, l.deal_value ? `$${(Number(l.deal_value) / 100).toFixed(0)}` : null].filter(Boolean).join(" · ")}
                  href={`/dashboard/leads?lead=${l.id}`}
                />
              ))}
            </FocusSection>
          )}
        </div>
      )}
    </div>
  );
}

function FocusSection({
  title, icon: Icon, color, count, children,
}: {
  title: string; icon: React.ElementType; color: string; count: number; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.4)",
      border: `1px solid ${color}25`,
      borderRadius: 10, padding: 12,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color }}>
          {title}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, color,
          background: `${color}20`, padding: "2px 6px", borderRadius: 999, marginLeft: "auto",
        }}>
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function FocusRow({
  primary, secondary, hint, href,
}: {
  primary: string; secondary?: string; hint?: string; href?: string;
}) {
  const content = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e8e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {primary}
        </div>
        {secondary && (
          <div style={{ fontSize: 10, color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {secondary}
          </div>
        )}
        {hint && (
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hint}
          </div>
        )}
      </div>
      <ChevronRight size={12} color="#444" style={{ flexShrink: 0 }} />
    </>
  );
  const baseStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 10px",
    background: "rgba(255,255,255,0.02)",
    borderRadius: 6,
    textDecoration: "none",
    color: "inherit",
    transition: "background 0.15s",
  };
  return href ? (
    <Link href={href} style={baseStyle}>{content}</Link>
  ) : (
    <div style={baseStyle}>{content}</div>
  );
}

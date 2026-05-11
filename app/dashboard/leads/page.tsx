'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business, type Lead, type Campaign } from '@/lib/agi-supabase';
import { loadBusinesses } from '@/lib/dashboard-businesses';
import { authFetch } from '@/lib/auth';
import {
  Users, TrendingUp, Target, Zap, ChevronDown,
  Mail, Phone, Link as LinkIcon, MapPin, Star, RefreshCw,
  CircleDot, CheckCircle2, XCircle, Clock, Award, Filter,
  Sparkles, Upload, Building2, BarChart3, Inbox, Settings as SettingsIcon,
  Bot, BookOpen, Calendar, CreditCard, Activity, Brain, Pencil
} from 'lucide-react';
import { AgentEditPanel } from '@/components/agi/AgentEditPanel';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG = {
  new:       { label: 'New',       color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  contacted: { label: 'Contacted', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)'  },
  qualified: { label: 'Qualified', color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  converted: { label: 'Converted', color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  lost:      { label: 'Lost',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
} as const;

const SOURCE_CONFIG = {
  apollo:   { label: 'Apollo',   color: '#a78bfa' },
  web:      { label: 'Web',      color: '#38bdf8' },
  linkedin: { label: 'LinkedIn', color: '#3b82f6' },
  referral: { label: 'Referral', color: '#fb923c' },
  manual:   { label: 'Manual',   color: '#94a3b8' },
} as const;

function scoreBg(score: number) {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#facc15';
  return '#f87171';
}

function fullName(l: Lead) {
  return [l.first_name, l.last_name].filter(Boolean).join(' ') || '—';
}

/* ─── Credit Meter ─── */
function CreditMeter({ businessId }: { businessId: string }) {
  const [data, setData] = useState<{ used: number; limit: number; remaining: number; reserved: number } | null>(null);

  useEffect(() => {
    authFetch(`/api/agi/credits?business_id=${businessId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => j && setData(j))
      .catch(() => {});
  }, [businessId]);

  if (!data) return null;
  const usable = data.limit - data.reserved;
  const pct = Math.min(100, (data.used / usable) * 100);
  const danger = data.used >= usable - 5;

  return (
    <div style={{
      background: '#191919', border: `1px solid ${danger ? '#fb923c' : '#222'}`,
      borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Zap size={12} color={danger ? '#fb923c' : '#10b981'} />
      <div>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Credits</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: danger ? '#fb923c' : '#94a3b8' }}>
          {data.used} / {usable}
        </div>
      </div>
      <div style={{ width: 60, background: '#0a0a0a', borderRadius: 3, height: 4 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: danger ? '#fb923c' : '#10b981',
        }} />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="agi-kpi-card" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: 8 }}><Icon size={18} color={color} /></div>
        <span style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 500 }}>{label}</span>
      </div>
      <div className="agi-kpi-value" style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1.5px', color: '#e8e8e8' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#555' }}>{sub}</div>}
    </div>
  );
}

function LeadRow({ lead, onClick, businessName }: { lead: Lead; onClick: () => void; businessName?: string }) {
  const st = STATUS_CONFIG[lead.status];
  const src = SOURCE_CONFIG[lead.source];
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer', borderBottom: '1px solid #161616', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#151515')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <td style={{ padding: '14px 12px' }}>
        <div style={{ fontWeight: 600, color: '#e8e8e8', fontSize: 13 }}>{fullName(lead)}</div>
        {lead.email && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{lead.email}</div>}
      </td>
      {businessName !== undefined ? (
        // All-businesses view: Business chip replaces the standalone Company
        // column (they'd both show the lead's company anyway). Compact.
        <td style={{ padding: '14px 12px' }}>
          <span className="agi-tag" style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', background: '#a78bfa18', padding: '3px 8px', borderRadius: 4 }}>
            {businessName || '—'}
          </span>
        </td>
      ) : (
        <td style={{ padding: '14px 12px', fontSize: 13, color: '#94a3b8' }}>{lead.company ?? '—'}</td>
      )}
      <td style={{ padding: '14px 12px', fontSize: 13, color: '#64748b' }}>{lead.title ?? '—'}</td>
      <td style={{ padding: '14px 12px' }}>
        <span className="agi-tag agi-tag-source" style={{ fontSize: 11, fontWeight: 600, color: src.color, background: `${src.color}15`, padding: '3px 8px', borderRadius: 4 }}>{src.label}</span>
      </td>
      <td style={{ padding: '14px 12px' }}>
        <span className="agi-tag agi-tag-status" style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 4 }}>{st.label}</span>
      </td>
      <td style={{ padding: '14px 12px' }}>
        <div className="agi-score-circle agi-score-sm" style={{
          width: 32, height: 32, borderRadius: '50%', background: `${scoreBg(lead.score)}22`,
          border: `2px solid ${scoreBg(lead.score)}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 700, color: scoreBg(lead.score),
        }}>{lead.score}</div>
      </td>
    </tr>
  );
}

function LeadPanel({ lead, onClose, onStatusChange, onProfileSaved }: { lead: Lead; onClose: () => void; onStatusChange: (id: string, status: Lead['status']) => void; onProfileSaved?: () => void }) {
  const { toast } = useToast();
  const src = SOURCE_CONFIG[lead.source];
  const [aliases, setAliases] = useState<string[]>([]);
  const [history, setHistory] = useState<Array<{ id: string; from_status: string | null; to_status: string; changed_at: string; note: string | null }>>([]);
  const [activity, setActivity] = useState<Array<{ id: string; event_type: string; event_subtype: string | null; details: Record<string, unknown> | null; created_at: string }>>([]);
  const [logging, setLogging] = useState(false);
  // Profile-backed leads can open the full agent editor (tier, arena card
  // overrides, premium flag, business link, etc.). For non-profile leads
  // (apollo/import/web), the button is hidden — there's no profile row to
  // edit and the regular fields are already inline above.
  const profileId = lead.source_table === 'profiles' ? lead.source_record_id : null;
  const [agentEditOpen, setAgentEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('omni_lead_email_aliases')
      .select('alias_email')
      .eq('primary_lead_id', lead.id)
      .order('alias_email')
      .then(({ data }) => {
        if (cancelled || !data) return;
        // Drop the primary email — it sometimes self-aliases
        const others = data
          .map(r => r.alias_email as string)
          .filter(e => e && e !== lead.email);
        setAliases(Array.from(new Set(others)));
      });

    // Status history timeline — fire in parallel via authFetch.
    authFetch(`/api/agi/leads/history?lead_id=${lead.id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { history: [] })
      .then(d => { if (!cancelled) setHistory(Array.isArray(d?.history) ? d.history : []); })
      .catch(() => {});

    // Activity log — calls, emails, notes
    authFetch(`/api/agi/leads/activity?lead_id=${lead.id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { activity: [] })
      .then(d => { if (!cancelled) setActivity(Array.isArray(d?.activity) ? d.activity : []); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [lead.id, lead.email]);

  async function logActivity(event_type: string, opts: { event_subtype?: string; note?: string } = {}) {
    setLogging(true);
    try {
      const r = await authFetch('/api/agi/leads/activity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id, event_type,
          event_subtype: opts.event_subtype,
          details: opts.note ? { note: opts.note } : undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        // Reload activity stream
        const r2 = await authFetch(`/api/agi/leads/activity?lead_id=${lead.id}`, { cache: 'no-store' });
        const d = r2.ok ? await r2.json().catch(() => ({})) : {};
        setActivity(Array.isArray(d?.activity) ? d.activity : []);
      }
    } finally {
      setLogging(false);
    }
  }

  // Split combined company string ("Omni AI · AI Integrated Solutions · Omni Leads LLC")
  const companies = (lead.company ?? '').split(/\s*·\s*/).filter(Boolean);

  const v = (val: string | number | null | undefined, fallback = '—') =>
    val !== null && val !== undefined && val !== '' ? String(val) : fallback;

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="agi-lead-panel-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="agi-lead-panel-shell" style={{ width: 480, maxWidth: '100%', background: '#0f0f0f', borderLeft: '1px solid #1e1e1e', height: '100%', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fullName(lead)}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {lead.title ?? 'No title'} {lead.company ? `@ ${lead.company}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 20, marginLeft: 12 }}>✕</button>
        </div>

        {/* Score row */}
        <div className="agi-panel-score-row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="agi-score-circle agi-score-lg" style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `${scoreBg(lead.score)}18`, border: `3px solid ${scoreBg(lead.score)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: scoreBg(lead.score),
          }}>{lead.score}</div>
          <div>
            <div style={{ fontSize: 12, color: '#555' }}>Lead Score</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
              {lead.score >= 80 ? '🔥 Hot lead' : lead.score >= 60 ? '☀ Warm lead' : '❄ Cold lead'}
            </div>
          </div>
          <span className="agi-tag agi-tag-source" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: src.color, background: `${src.color}15`, padding: '4px 10px', borderRadius: 4 }}>{src.label}</span>
        </div>

        {/* Contact */}
        <Section title="Contact">
          <Row icon={Mail} label="Email" value={lead.email ? <a href={`mailto:${lead.email}`} style={{ color: '#818cf8', wordBreak: 'break-all' }}>{lead.email}</a> : '—'} />
          <Row icon={Phone} label="Phone" value={lead.phone ? <a href={`tel:${lead.phone}`} style={{ color: '#818cf8' }}>{lead.phone}</a> : '—'} />
          <Row icon={LinkIcon} label="LinkedIn" value={lead.linkedin_url ? <a href={lead.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>Profile ↗</a> : '—'} />
          <Row icon={MapPin} label="Location" value={v(lead.lead_location)} />
        </Section>

        {/* Other Contacts (aliased emails merged into this lead) */}
        {aliases.length > 0 && (
          <Section title={`Other Contacts · ${aliases.length}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aliases.map(email => (
                <a
                  key={email}
                  href={`mailto:${email}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: '#0a0a0a', border: '1px solid #1e1e1e',
                    color: '#cbd5e1', fontSize: 12, textDecoration: 'none',
                    wordBreak: 'break-all',
                  }}
                >
                  <Mail size={13} color="#818cf8" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{email}</span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Company */}
        <Section title={`Companies${companies.length > 1 ? ` · ${companies.length}` : ''}`}>
          <Row icon={Star} label="Title" value={v(lead.title)} />
          {companies.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12 }}>
              <Building2 size={13} color="#555" style={{ flexShrink: 0, marginTop: 3 }} />
              <span style={{ color: '#666', minWidth: 80 }}>{companies.length > 1 ? 'Businesses' : 'Company'}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {companies.map(c => (
                  <span key={c} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    background: 'linear-gradient(135deg, #1a1a2e, #111)',
                    border: '1px solid #a78bfa30', color: '#cbd5e1', fontWeight: 600,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          ) : (
            <Row icon={Building2} label="Company" value="—" />
          )}
        </Section>

        {/* Pipeline */}
        {(lead.deal_stage || lead.deal_value || lead.expected_close_date) && (
          <Section title="Pipeline">
            <Row icon={Target} label="Stage" value={v(lead.deal_stage)} />
            {lead.deal_value !== null && lead.deal_value !== undefined && (
              <Row icon={Award} label="Deal Value" value={`$${(Number(lead.deal_value) / 100).toFixed(0)}`} />
            )}
            <Row icon={CircleDot} label="Status" value={v(lead.status)} />
            <Row label="Expected Close" value={fmtDate(lead.expected_close_date)} />
          </Section>
        )}

        {/* AI Insights */}
        {(lead.ai_score_reasoning || lead.ai_recommended_angle) && (
          <Section title="AI Insights" highlight>
            {lead.ai_score_reasoning && (
              <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 8 }}>
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>Reasoning:</span> {lead.ai_score_reasoning}
              </div>
            )}
            {lead.ai_recommended_angle && (
              <div style={{ fontSize: 12, color: '#facc15', lineHeight: 1.6, fontStyle: 'italic' }}>
                💡 {lead.ai_recommended_angle}
              </div>
            )}
          </Section>
        )}

        {/* Notes */}
        {lead.notes && (
          <Section title="Notes & Activity">
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {lead.notes}
            </div>
          </Section>
        )}

        {/* Quick log buttons + activity stream */}
        <Section title={`Activity${activity.length > 0 ? ` · ${activity.length}` : ''}`}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => logActivity('call', { event_subtype: 'made' })} disabled={logging}
              style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#10b981', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: logging ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Phone size={11} /> Log call
            </button>
            <button onClick={() => logActivity('email', { event_subtype: 'sent' })} disabled={logging}
              style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#818cf8', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: logging ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Mail size={11} /> Log email
            </button>
            <button onClick={() => {
              const note = prompt('Add a note to this lead:');
              if (note?.trim()) logActivity('note', { note });
            }} disabled={logging}
              style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#facc15', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: logging ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Star size={11} /> Add note
            </button>
          </div>

          {activity.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {activity.slice(0, 8).map(a => {
                const c = a.event_type === 'call' ? '#10b981'
                       : a.event_type === 'email' ? '#818cf8'
                       : a.event_type === 'note' ? '#facc15'
                       : a.event_type === 'meeting' ? '#a78bfa'
                       : '#666';
                const note = (a.details as { note?: string } | null)?.note;
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', background: '#0a0a0a', borderRadius: 6, border: '1px solid #1a1a1a' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, marginTop: 5, flexShrink: 0, boxShadow: `0 0 4px ${c}80` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#e8e8e8' }}>
                        <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{a.event_type}</span>
                        {a.event_subtype && <span style={{ color: '#666' }}> · {a.event_subtype}</span>}
                      </div>
                      {note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{note}</div>}
                      <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
                        {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Status timeline — every transition this lead has gone through */}
        {history.length > 0 && (
          <Section title={`Status Timeline · ${history.length}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
              {/* Vertical line behind dots */}
              <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: '#1e1e1e', zIndex: 0 }} />
              {history.map((h, i) => {
                const cfg = STATUS_CONFIG[h.to_status as Lead['status']];
                const color = cfg?.color ?? '#666';
                const date = new Date(h.changed_at);
                return (
                  <div key={h.id} style={{ display: 'flex', gap: 12, padding: '8px 0', position: 'relative', zIndex: 1 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 8px ${color}80`,
                      flexShrink: 0, marginTop: 2,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#e8e8e8', fontWeight: 600 }}>
                        {h.from_status
                          ? <span><span style={{ color: '#666' }}>{h.from_status}</span> → <span style={{ color }}>{h.to_status}</span></span>
                          : <span style={{ color }}>{h.to_status === 'new' ? 'Lead created' : `Started as ${h.to_status}`}</span>
                        }
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                        {date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {i < history.length - 1 && (() => {
                          const next = new Date(history[i + 1].changed_at);
                          const days = Math.round((next.getTime() - date.getTime()) / 86_400_000);
                          if (days < 1) return <span style={{ marginLeft: 8, color: '#444' }}> · {Math.round((next.getTime() - date.getTime()) / 3_600_000)}h to next</span>;
                          return <span style={{ marginLeft: 8, color: '#444' }}> · {days}d to next</span>;
                        })()}
                      </div>
                      {h.note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>{h.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Win/Loss */}
        {(lead.win_loss_reason || lead.win_loss_category || lead.competitor_name) && (
          <Section title="Win / Loss">
            <Row label="Category" value={v(lead.win_loss_category)} />
            <Row label="Reason" value={v(lead.win_loss_reason)} />
            <Row label="Competitor" value={v(lead.competitor_name)} />
          </Section>
        )}

        {/* Tags */}
        {lead.tags && lead.tags.length > 0 && (
          <Section title="Tags">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lead.tags.map(t => (
                <span key={t} className="agi-tag agi-tag-tag" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: '#1a1a1a', color: '#94a3b8' }}>{t}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Metadata */}
        <Section title="Metadata">
          <Row label="Source" value={`${src.label}${lead.source_table ? ` · ${lead.source_table}` : ''}`} />
          <Row label="Created" value={fmtDate(lead.created_at)} />
          {lead.updated_at && <Row label="Updated" value={fmtDate(lead.updated_at)} />}
          <Row label="Lead ID" value={<code style={{ fontSize: 10, color: '#666', fontFamily: 'ui-monospace, monospace' }}>{lead.id.slice(0, 8)}…</code>} />
        </Section>

        {/* Update Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Update Status</div>
          <div className="agi-status-btn-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(STATUS_CONFIG) as Lead['status'][]).map(s => {
              const c = STATUS_CONFIG[s];
              const active = lead.status === s;
              return (
                <button key={s} className="agi-status-btn" onClick={() => onStatusChange(lead.id, s)} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${active ? c.color : '#222'}`,
                  background: active ? c.bg : 'transparent',
                  color: active ? c.color : '#555',
                }}>{c.label}</button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profileId && (
            <button
              onClick={() => setAgentEditOpen(true)}
              title="Open the full agent editor — edit tier, arena card stats (value/rating/reach), premium flag, linked business, and confidential contact info."
              style={{
                background: 'linear-gradient(135deg, #1a1532, #0d0d0d)',
                border: '1px solid #a78bfa60', color: '#c4b5fd',
                padding: '10px 20px', borderRadius: 10,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Pencil size={12} /> Edit full profile · tier, card &amp; stats
            </button>
          )}
          <button
            onClick={async () => {
              const r = await authFetch('/api/agi/leads/score-ai', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_id: lead.id }),
              });
              const j = await r.json().catch(() => ({}));
              if (j.ok) {
                toast({
                  title: `AI Score: ${j.score}`,
                  description: `${j.reasoning}\n\nAngle: ${j.recommended_angle}`,
                });
              } else {
                toast({ title: 'Score failed', description: j.error || `HTTP ${r.status}`, variant: 'destructive' });
              }
            }}
            style={{
              background: '#191919', border: '1px solid #a78bfa40', color: '#a78bfa',
              padding: '10px 20px', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Sparkles size={12} /> AI Re-Score
          </button>
          <Link href={`/dashboard/outreach?lead_id=${lead.id}`} style={{
            background: 'linear-gradient(135deg, #10b981, #818cf8)',
            color: '#fff', padding: '12px 20px', borderRadius: 10,
            fontSize: 13, fontWeight: 700, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Sparkles size={14} /> Generate Outreach Assets
          </Link>
        </div>
      </div>

      {/* Full agent / profile editor — only mounts when explicitly opened.
          On save, refreshes the parent lead list so trigger-driven changes
          (status, company, etc.) flow back into the visible row. */}
      {agentEditOpen && profileId && (
        <AgentEditPanel
          agentId={profileId}
          onClose={() => setAgentEditOpen(false)}
          onSaved={() => { setAgentEditOpen(false); onProfileSaved?.(); }}
        />
      )}
    </div>
  );
}

/* Reusable section + row */
function Section({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'linear-gradient(135deg, #1a1a2e 0%, #111 100%)' : '#111',
      border: `1px solid ${highlight ? '#a78bfa40' : '#1e1e1e'}`,
      borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 11, color: highlight ? '#a78bfa' : '#444', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 700 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      {Icon && <Icon size={13} color="#555" style={{ flexShrink: 0 }} />}
      <span style={{ color: '#666', minWidth: 80 }}>{label}</span>
      <span style={{ color: '#cbd5e1', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Deep-link support: ?lead=<id> auto-opens the lead detail panel.
  // Used by Today's Focus tiles + email links + share-this-lead URLs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('lead');
    if (!id || leads.length === 0) return;
    const found = leads.find(l => l.id === id);
    if (found) setSelectedLead(found);
  }, [leads]);
  const [generating, setGenerating] = useState(false);
  const [scoringAll, setScoringAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bizOpen, setBizOpen] = useState(false);

  useEffect(() => {
    loadBusinesses().then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        // Honor the global business switcher (set on /assets via localStorage).
        // null and "all" both mean "All Businesses" — matches the AgiAdminPanel
        // header which renders "All" for both states. Previously this branch
        // silently defaulted unset → Omni AI which made the panel header
        // ("All") disagree with the leads count (Omni AI's 17 leads instead
        // of 318 across all businesses).
        const stored = typeof window !== 'undefined' ? localStorage.getItem('omni_active_business_id') : null;
        if (!stored || stored === 'all') {
          setSelectedBiz(null);
        } else {
          const found = data.find(b => b.id === stored);
          setSelectedBiz(found ?? null);
        }
      }
      setLoading(false);
    });
  }, []);

  // React to live changes from the /assets switcher (storage event)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== 'omni_active_business_id') return;
      const v = ev.newValue;
      if (!v || v === 'all') return setSelectedBiz(null);
      const found = businesses.find(b => b.id === v);
      if (found) setSelectedBiz(found);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  // Tracks the latest workspace key so an older in-flight loadData can detect
  // it's stale and bail before stomping fresh state. Encodes null as "all" so
  // the All-Businesses sentinel is comparable.
  const activeBizKeyRef = useRef<string>('all');
  const loadData = useCallback(async (bizId: string | null) => {
    // bizId === null means "All Businesses" — drop the business_id filter.
    // Build a fresh PostgREST query builder per call. Reusing one builder
    // across two awaited calls (with vs without .eq()) caused stale results
    // when selectedBiz changed: the second loadData kept returning the first
    // call's 320 rows even after .eq() was applied, so a client viewer like
    // Sammy got pinned to LTB but still saw all-businesses leads.
    // Clear out the previous workspace's leads first so we don't briefly
    // render the wrong tenant's data while the new query resolves.
    const requestedKey = bizId ?? 'all';
    activeBizKeyRef.current = requestedKey;
    setLeads([]);
    setCampaigns([]);
    // Leads come from the server endpoint (service-role) because
    // omni_leads_generated has a service_role_all RLS policy that blocks
    // the browser anon client — the previous direct .from('omni_leads_generated')
    // call silently returned zero rows on every request. Campaigns table
    // is not RLS-locked the same way, so it stays on the browser client
    // for now.
    const leadsUrl = `/api/dashboard/leads?business_id=${encodeURIComponent(bizId ?? 'all')}&limit=5000`;
    const campsBase = () => supabase.from('omni_lead_campaigns').select('*');
    const [leadsRes, { data: campData }] = await Promise.all([
      authFetch(leadsUrl).then(r => (r.ok ? r.json() : { leads: [] })).catch(() => ({ leads: [] })),
      bizId ? campsBase().eq('business_id', bizId) : campsBase(),
    ]);
    // If the user switched workspaces during the await, drop this response.
    if (activeBizKeyRef.current !== requestedKey) return;
    setLeads((leadsRes?.leads as Lead[] | undefined) ?? []);
    setCampaigns(campData ?? []);
  }, []);

  // selectedBiz === null is the "All Businesses" sentinel.
  // Skip the initial loadData while businesses are still loading — otherwise
  // the page briefly fetches all 320 leads with bizId=null before the
  // workspace pin resolves to (e.g.) LTB and we re-fetch the 2 LTB leads.
  // After the pin lands, `loading` flips false and the load fires once
  // against the correctly-scoped business.
  useEffect(() => {
    if (loading) return;
    loadData(selectedBiz ? selectedBiz.id : null);
  }, [selectedBiz, loadData, loading]);

  const total = leads.length;
  const qualified = leads.filter(l => l.status === 'qualified' || l.status === 'converted').length;
  const converted = leads.filter(l => l.status === 'converted').length;
  const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0;
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const filtered = leads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
    return true;
  });

  async function runAgent() {
    if (!selectedBiz || !campaigns[0]) return;
    setGenerating(true);
    await authFetch('/api/agi/leads/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id, campaign_id: campaigns[0].id, icp: campaigns[0].icp }),
    });
    await loadData(selectedBiz.id);
    setGenerating(false);
  }

  async function rescoreAll() {
    if (!selectedBiz) return;
    if (!confirm(`Re-score every lead in ${selectedBiz.name} with Claude? This may take a minute.`)) return;
    setScoringAll(true);
    try {
      const r = await authFetch('/api/agi/leads/bulk-score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: selectedBiz.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.error) {
        toast({ title: 'Score failed', description: d.error, variant: 'destructive' });
      } else {
        // After re-score, fire hot-lead alerts for any newly hot leads
        await authFetch('/api/agi/leads/hot-lead-alerts', { method: 'POST' }).catch(() => {});
        toast({
          title: 'Re-score complete',
          description: `Scored ${d.scored ?? '?'} leads.${d.errors ? ` ${d.errors} errors.` : ''}`,
        });
        await loadData(selectedBiz.id);
      }
    } finally {
      setScoringAll(false);
    }
  }

  async function handleStatusChange(id: string, status: Lead['status']) {
    await authFetch('/api/agi/leads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : null);
  }

  if (loading) {
    return <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontSize: 14 }}>Loading dashboard…</div>
    </div>;
  }

  const planColor = selectedBiz?.plan === 'enterprise' ? '#fb923c' : selectedBiz?.plan === 'pro' ? '#818cf8' : '#10b981';

  return (
    <div className="agi-leads-root" style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <style jsx global>{`
        /* ── Mobile-first overrides for agentic Leads dashboard ── */
        @media (max-width: 900px) {
          .agi-leads-root .agi-leads-header {
            height: auto !important;
            padding: 12px 16px !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .agi-leads-root .agi-leads-header-left {
            width: 100%;
            flex-wrap: wrap;
            gap: 10px !important;
          }
          .agi-leads-root .agi-leads-nav {
            width: 100%;
            overflow-x: auto;
            flex-wrap: nowrap !important;
            padding-bottom: 4px;
            scrollbar-width: thin;
          }
          .agi-leads-root .agi-leads-nav a {
            white-space: nowrap;
          }
          .agi-leads-root .agi-leads-actions {
            margin-left: auto;
            gap: 8px !important;
          }
          .agi-leads-root .agi-leads-content {
            padding: 16px !important;
          }
          .agi-leads-root .agi-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 20px !important;
          }
          .agi-leads-root .agi-kpi-card {
            padding: 14px !important;
          }
          .agi-leads-root .agi-kpi-value {
            font-size: 26px !important;
          }
          .agi-leads-root .agi-campaigns-row {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .agi-leads-root .agi-lead-panel-shell {
            width: 100vw !important;
            padding: 20px !important;
          }
        }
        @media (max-width: 640px) {
          .agi-leads-root .agi-leads-header-divider { display: none !important; }
          .agi-leads-root .agi-leads-brand-text { font-size: 14px !important; }
          .agi-leads-root .agi-credit-meter { display: none !important; }
          .agi-leads-root .agi-leads-action-refresh span { display: none !important; }
          .agi-leads-root .agi-leads-table th:nth-child(3),
          .agi-leads-root .agi-leads-table td:nth-child(3) { display: none !important; }
          .agi-leads-root .agi-leads-table th:nth-child(4),
          .agi-leads-root .agi-leads-table td:nth-child(4) { display: none !important; }
        }
        @media (max-width: 480px) {
          .agi-leads-root .agi-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* ── Mobile-friendly tags / badges / chips ── */
        @media (max-width: 768px) {
          .agi-leads-root .agi-tag {
            font-size: 11px !important;
            padding: 4px 10px !important;
            border-radius: 6px !important;
            line-height: 1.3 !important;
            display: inline-flex !important;
            align-items: center !important;
            min-height: 22px;
            white-space: nowrap;
          }
          .agi-leads-root .agi-tag-tag {
            font-size: 11px !important;
            padding: 5px 10px !important;
          }
          .agi-leads-root .agi-tag-plan {
            font-size: 10px !important;
            padding: 3px 8px !important;
          }
          .agi-leads-root .agi-score-circle.agi-score-sm {
            width: 36px !important;
            height: 36px !important;
            font-size: 12px !important;
          }
          .agi-leads-root .agi-score-circle.agi-score-lg {
            width: 60px !important;
            height: 60px !important;
            font-size: 20px !important;
          }
          .agi-leads-root .agi-panel-score-row {
            flex-wrap: wrap;
          }
          .agi-leads-root .agi-filter-strip {
            padding: 12px 14px !important;
            gap: 8px !important;
          }
          .agi-leads-root .agi-filter-btn {
            padding: 6px 12px !important;
            font-size: 12px !important;
            min-height: 30px;
          }
          .agi-leads-root .agi-filter-count {
            width: 100%;
            margin-left: 0 !important;
            font-size: 11px !important;
          }
          .agi-leads-root .agi-status-btn {
            padding: 8px 14px !important;
            font-size: 12px !important;
            min-height: 36px;
            flex: 1 1 calc(50% - 4px);
            text-align: center;
          }
        }
      `}</style>

      <header className="agi-leads-header" style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="agi-leads-header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e8e8e8' }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #10b981, #818cf8)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="#fff" />
            </div>
            <span className="agi-leads-brand-text" style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>OmniLeads<span style={{ color: '#10b981' }}>AGI</span></span>
          </Link>
          <div className="agi-leads-header-divider" style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBizOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#191919', border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e8e8e8' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedBiz?.name ?? 'All Businesses'}</span>
              {selectedBiz ? (
                <span className="agi-tag agi-tag-plan" style={{ fontSize: 10, fontWeight: 700, color: planColor, background: `${planColor}18`, padding: '2px 6px', borderRadius: 4 }}>{selectedBiz.plan.toUpperCase()}</span>
              ) : (
                <span className="agi-tag" style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', background: '#a78bfa18', padding: '2px 6px', borderRadius: 4 }}>{businesses.length}</span>
              )}
              <ChevronDown size={13} color="#555" />
            </button>
            {bizOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#111', border: '1px solid #222', borderRadius: 10, minWidth: 240, zIndex: 10, overflow: 'hidden' }}>
                {/* Admin sees the full switcher (All + every business). Client
                    viewers only see their own pinned workspace — no
                    cross-tenant escape hatch. Detected via the omni_user
                    is_admin flag stashed by auth-login. */}
                {(() => {
                  let isAdmin = false;
                  try {
                    if (typeof window !== 'undefined') {
                      const u = JSON.parse(localStorage.getItem('omni_user') || 'null');
                      isAdmin = !!u?.is_admin;
                    }
                  } catch {}
                  const visibleBizs = isAdmin ? businesses : (selectedBiz ? [selectedBiz] : []);
                  return (
                    <>
                      {isAdmin && (
                        <button
                          onClick={() => { setSelectedBiz(null); setBizOpen(false); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                            background: selectedBiz === null ? '#191919' : 'transparent',
                            border: 'none', borderBottom: '1px solid #1e1e1e', color: '#e8e8e8', cursor: 'pointer', fontSize: 13,
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#a78bfa' }}>All Businesses</div>
                          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Combined view · {businesses.length} businesses</div>
                        </button>
                      )}
                      {visibleBizs.map(b => (
                        <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{b.industry} · {b.location}</div>
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <div className="agi-leads-header-divider" style={{ width: 1, height: 20, background: '#222' }} />
          <nav className="agi-leads-nav" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Link href="/dashboard/leads" style={navStyle(true)}>Leads</Link>
            <Link href="/dashboard/autopilot" style={navStyle(false)}><Bot size={11} /> Autopilot</Link>
            <Link href="/dashboard/coach" style={navStyle(false)}><Brain size={11} /> Coach</Link>
            <Link href="/dashboard/inbox" style={navStyle(false)}><Inbox size={11} /> Inbox</Link>
            <Link href="/dashboard/meetings" style={navStyle(false)}><Calendar size={11} /> Meetings</Link>
            <Link href="/dashboard/pipeline" style={navStyle(false)}><Award size={11} /> Pipeline</Link>
            {selectedBiz?.name === 'Omni AI' && (
              <>
                <Link href="/dashboard/sponsor" style={navStyle(false)}><Award size={11} /> Sponsors</Link>
                <Link href="/dashboard/affiliate" style={navStyle(false)}><Award size={11} /> Affiliates</Link>
              </>
            )}
            <Link href="/dashboard/heatmap" style={navStyle(false)}><Activity size={11} /> Heatmap</Link>
            <Link href="/dashboard/billing" style={navStyle(false)}><CreditCard size={11} /> Billing</Link>
            <Link href="/dashboard/outreach" style={navStyle(false)}><Sparkles size={11} /> Outreach</Link>
            <Link href="/dashboard/companies" style={navStyle(false)}><Building2 size={11} /> Companies</Link>
            <Link href="/dashboard/campaigns" style={navStyle(false)}><Target size={11} /> Campaigns</Link>
            <Link href="/dashboard/templates" style={navStyle(false)}><BookOpen size={11} /> Templates</Link>
            <Link href="/dashboard/analytics" style={navStyle(false)}><BarChart3 size={11} /> Analytics</Link>
            <Link href="/dashboard/import" style={navStyle(false)}><Upload size={11} /> Import</Link>
            <Link href="/dashboard/settings" style={navStyle(false)}><SettingsIcon size={11} /> Settings</Link>
          </nav>
        </div>

        <div className="agi-leads-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedBiz && <div className="agi-credit-meter"><CreditMeter businessId={selectedBiz.id} /></div>}
          <button className="agi-leads-action-refresh" onClick={() => loadData(selectedBiz ? selectedBiz.id : null)} style={{ background: 'none', border: '1px solid #222', color: '#555', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <RefreshCw size={12} /><span>Refresh</span>
          </button>
          <button
            onClick={rescoreAll}
            disabled={scoringAll || !selectedBiz || leads.length === 0}
            title={!selectedBiz ? 'Select a specific business to re-score' : ''}
            style={{
              background: scoringAll ? '#1a1532' : 'transparent',
              color: scoringAll ? '#a78bfa' : '#a78bfa',
              border: '1px solid #a78bfa40',
              padding: '7px 14px', borderRadius: 8,
              cursor: scoringAll || !selectedBiz || leads.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: !selectedBiz || leads.length === 0 ? 0.5 : 1,
            }}
          >
            <Brain size={12} />
            {scoringAll ? 'Re-scoring…' : 'Re-score all'}
          </button>
          <button onClick={runAgent} disabled={generating || !campaigns.length || !selectedBiz} title={!selectedBiz ? 'Select a specific business to run the agent' : ''} style={{ background: generating || !selectedBiz ? '#0d2a1e' : '#10b981', color: generating || !selectedBiz ? '#10b981' : '#fff', border: generating || !selectedBiz ? '1px solid #10b981' : 'none', padding: '7px 16px', borderRadius: 8, cursor: generating || !selectedBiz ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: !selectedBiz ? 0.6 : 1 }}>
            <Zap size={13} />
            {generating ? 'Generating…' : 'Run Agent'}
          </button>
        </div>
      </header>

      <div className="agi-leads-content" style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
        <div className="agi-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KpiCard icon={Users} label="Total Leads" value={total} sub={`${filtered.length} shown`} color="#818cf8" />
          <KpiCard icon={Star} label="Qualified" value={qualified} sub={`${total > 0 ? Math.round((qualified/total)*100) : 0}% of total`} color="#10b981" />
          <KpiCard icon={Award} label="Conversion Rate" value={`${convRate}%`} sub={`${converted} converted`} color="#4ade80" />
          <KpiCard icon={TrendingUp} label="Avg Score" value={avgScore} sub="out of 100" color="#facc15" />
        </div>

        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          <div className="agi-filter-strip" style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Filter size={14} color="#555" />
            <span style={{ fontSize: 12, color: '#555', marginRight: 4 }}>Status:</span>
            {['all', ...Object.keys(STATUS_CONFIG)].map(s => {
              const active = statusFilter === s;
              const cfg = s !== 'all' ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] : null;
              return (
                <button key={s} className="agi-filter-btn" onClick={() => setStatusFilter(s)} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${active ? (cfg?.color ?? '#555') : '#222'}`,
                  background: active ? (cfg?.bg ?? 'rgba(255,255,255,0.06)') : 'transparent',
                  color: active ? (cfg?.color ?? '#e8e8e8') : '#555',
                }}>{s === 'all' ? 'All' : cfg!.label}</button>
              );
            })}
            <span className="agi-filter-count" style={{ marginLeft: 'auto', fontSize: 12, color: '#444' }}>{filtered.length} leads</span>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <table className="agi-leads-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#111', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                  {(selectedBiz === null
                    ? ['Contact', 'Business', 'Title', 'Source', 'Status', 'Score']
                    : ['Contact', 'Company', 'Title', 'Source', 'Status', 'Score']
                  ).map(h => (
                    <th key={h} style={{ padding: '12px', textAlign: 'left', color: '#444', fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#333', fontSize: 13 }}>
                    {selectedBiz ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div>No leads under <strong style={{ color: '#94a3b8' }}>{selectedBiz.name}</strong> yet.</div>
                        {/* Only admins get the "Show all businesses" escape hatch.
                            For client viewers (sammy/jaime/adam/brent/cps) that
                            button would expose every other tenant's leads via
                            the all-leads supabase query — privacy hole.
                            Detected by reading the omni_user payload localStorage
                            stash from the auth-login response. */}
                        {(() => {
                          if (typeof window === 'undefined') return null;
                          let isAdmin = false;
                          try {
                            const u = JSON.parse(localStorage.getItem('omni_user') || 'null');
                            isAdmin = !!u?.is_admin;
                          } catch {}
                          if (!isAdmin) return null;
                          return (
                            <button
                              onClick={() => {
                                localStorage.setItem('omni_active_business_id', 'all');
                                window.dispatchEvent(new StorageEvent('storage', { key: 'omni_active_business_id', newValue: 'all' }));
                                setSelectedBiz(null);
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #a78bfa, #38bdf8)',
                                color: '#fff', border: 'none',
                                padding: '8px 16px', borderRadius: 8,
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              Show all businesses
                            </button>
                          );
                        })()}
                      </div>
                    ) : (
                      <>No leads found. {campaigns.length > 0 ? 'Click "Run Agent" to generate leads.' : 'Import leads via the Import tab.'}</>
                    )}
                  </td></tr>
                ) : (
                  filtered.map(lead => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      onClick={() => setSelectedLead(lead)}
                      // In All view, show each lead's OWN company (Alira /
                      // Leifson Built / BLK Diamond / etc.) — not the parent
                      // dashboard business they're filed under.
                      businessName={selectedBiz === null
                        ? (lead.company ?? '')
                        : undefined}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
          onProfileSaved={async () => {
            // The profile-sync trigger fires on UPDATE, so the lead row in
            // omni_leads_generated reflects fresh company/title/status. Pull
            // the updated row + refresh the side panel selection.
            await loadData(selectedBiz ? selectedBiz.id : null);
            if (selectedLead) {
              const { data } = await supabase.from('omni_leads_generated').select('*').eq('id', selectedLead.id).maybeSingle();
              if (data) setSelectedLead(data as Lead);
            }
          }}
        />
      )}
    </div>
  );
}

function navStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
    color: active ? '#10b981' : '#666',
    background: active ? '#0d2a1e' : 'transparent',
    display: 'flex', alignItems: 'center', gap: 6,
  };
}

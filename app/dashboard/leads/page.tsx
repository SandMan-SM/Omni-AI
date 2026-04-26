'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, type Business, type Lead, type Campaign } from '@/lib/agi-supabase';
import {
  Users, TrendingUp, Target, Zap, ChevronDown,
  Mail, Phone, Link as LinkIcon, MapPin, Star, RefreshCw,
  CircleDot, CheckCircle2, XCircle, Clock, Award, Filter,
  Sparkles, Upload, Building2, BarChart3, Inbox, Settings as SettingsIcon,
  Bot, BookOpen, Calendar, CreditCard, Activity, Brain
} from 'lucide-react';

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
    fetch(`/api/agi/credits?business_id=${businessId}`).then(r => r.json()).then(setData);
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
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: 8 }}><Icon size={18} color={color} /></div>
        <span style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1.5px', color: '#e8e8e8' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#555' }}>{sub}</div>}
    </div>
  );
}

function LeadRow({ lead, onClick }: { lead: Lead; onClick: () => void }) {
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
      <td style={{ padding: '14px 12px', fontSize: 13, color: '#94a3b8' }}>{lead.company ?? '—'}</td>
      <td style={{ padding: '14px 12px', fontSize: 13, color: '#64748b' }}>{lead.title ?? '—'}</td>
      <td style={{ padding: '14px 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: src.color, background: `${src.color}15`, padding: '3px 8px', borderRadius: 4 }}>{src.label}</span>
      </td>
      <td style={{ padding: '14px 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 4 }}>{st.label}</span>
      </td>
      <td style={{ padding: '14px 12px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: `${scoreBg(lead.score)}22`,
          border: `2px solid ${scoreBg(lead.score)}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 700, color: scoreBg(lead.score),
        }}>{lead.score}</div>
      </td>
    </tr>
  );
}

function LeadPanel({ lead, onClose, onStatusChange }: { lead: Lead; onClose: () => void; onStatusChange: (id: string, status: Lead['status']) => void }) {
  const src = SOURCE_CONFIG[lead.source];
  const [aliases, setAliases] = useState<string[]>([]);

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
    return () => { cancelled = true; };
  }, [lead.id, lead.email]);

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ width: 480, background: '#0f0f0f', borderLeft: '1px solid #1e1e1e', height: '100%', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }} onClick={e => e.stopPropagation()}>

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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
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
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: src.color, background: `${src.color}15`, padding: '4px 10px', borderRadius: 4 }}>{src.label}</span>
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
                <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: '#1a1a1a', color: '#94a3b8' }}>{t}</span>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(STATUS_CONFIG) as Lead['status'][]).map(s => {
              const c = STATUS_CONFIG[s];
              const active = lead.status === s;
              return (
                <button key={s} onClick={() => onStatusChange(lead.id, s)} style={{
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
          <button
            onClick={async () => {
              const r = await fetch('/api/agi/leads/score-ai', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_id: lead.id }),
              });
              const j = await r.json();
              if (j.ok) {
                alert(`AI Score: ${j.score}\n\n${j.reasoning}\n\nAngle: ${j.recommended_angle}`);
              } else {
                alert(`Failed: ${j.error}`);
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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bizOpen, setBizOpen] = useState(false);

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        setSelectedBiz(data[0]);
      }
      setLoading(false);
    });
  }, []);

  const loadData = useCallback(async (bizId: string) => {
    const [{ data: leadsData }, { data: campData }] = await Promise.all([
      supabase.from('omni_leads_generated').select('*').eq('business_id', bizId).order('created_at', { ascending: false }),
      supabase.from('omni_lead_campaigns').select('*').eq('business_id', bizId),
    ]);
    setLeads(leadsData ?? []);
    setCampaigns(campData ?? []);
  }, []);

  useEffect(() => { if (selectedBiz) loadData(selectedBiz.id); }, [selectedBiz, loadData]);

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
    await fetch('/api/agi/leads/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id, campaign_id: campaigns[0].id, icp: campaigns[0].icp }),
    });
    await loadData(selectedBiz.id);
    setGenerating(false);
  }

  async function handleStatusChange(id: string, status: Lead['status']) {
    await fetch('/api/agi/leads', {
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
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>

      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e8e8e8' }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #10b981, #818cf8)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>OmniLeads<span style={{ color: '#10b981' }}>AGI</span></span>
          </Link>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBizOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#191919', border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e8e8e8' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedBiz?.name ?? 'Select Business'}</span>
              {selectedBiz && <span style={{ fontSize: 10, fontWeight: 700, color: planColor, background: `${planColor}18`, padding: '2px 6px', borderRadius: 4 }}>{selectedBiz.plan.toUpperCase()}</span>}
              <ChevronDown size={13} color="#555" />
            </button>
            {bizOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#111', border: '1px solid #222', borderRadius: 10, minWidth: 220, zIndex: 10, overflow: 'hidden' }}>
                {businesses.map(b => (
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{b.industry} · {b.location}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Link href="/dashboard/leads" style={navStyle(true)}>Leads</Link>
            <Link href="/dashboard/autopilot" style={navStyle(false)}><Bot size={11} /> Autopilot</Link>
            <Link href="/dashboard/coach" style={navStyle(false)}><Brain size={11} /> Coach</Link>
            <Link href="/dashboard/inbox" style={navStyle(false)}><Inbox size={11} /> Inbox</Link>
            <Link href="/dashboard/meetings" style={navStyle(false)}><Calendar size={11} /> Meetings</Link>
            <Link href="/dashboard/pipeline" style={navStyle(false)}><Award size={11} /> Pipeline</Link>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedBiz && <CreditMeter businessId={selectedBiz.id} />}
          <button onClick={() => selectedBiz && loadData(selectedBiz.id)} style={{ background: 'none', border: '1px solid #222', color: '#555', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={runAgent} disabled={generating || !campaigns.length} style={{ background: generating ? '#0d2a1e' : '#10b981', color: generating ? '#10b981' : '#fff', border: generating ? '1px solid #10b981' : 'none', padding: '7px 16px', borderRadius: 8, cursor: generating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={13} />
            {generating ? 'Generating…' : 'Run Agent'}
          </button>
        </div>
      </header>

      <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KpiCard icon={Users} label="Total Leads" value={total} sub={`${filtered.length} shown`} color="#818cf8" />
          <KpiCard icon={Star} label="Qualified" value={qualified} sub={`${total > 0 ? Math.round((qualified/total)*100) : 0}% of total`} color="#10b981" />
          <KpiCard icon={Award} label="Conversion Rate" value={`${convRate}%`} sub={`${converted} converted`} color="#4ade80" />
          <KpiCard icon={TrendingUp} label="Avg Score" value={avgScore} sub="out of 100" color="#facc15" />
        </div>

        {campaigns.length > 0 && (
          <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
            {campaigns.map(c => {
              const pct = Math.min(100, Math.round((c.leads_generated / c.leads_target) * 100));
              return (
                <div key={c.id} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 18px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: '#555' }}>{c.leads_generated} / {c.leads_target} leads</span>
                  </div>
                  <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #818cf8)', height: '100%' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>{pct}% to target</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Filter size={14} color="#555" />
            <span style={{ fontSize: 12, color: '#555', marginRight: 4 }}>Status:</span>
            {['all', ...Object.keys(STATUS_CONFIG)].map(s => {
              const active = statusFilter === s;
              const cfg = s !== 'all' ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] : null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${active ? (cfg?.color ?? '#555') : '#222'}`,
                  background: active ? (cfg?.bg ?? 'rgba(255,255,255,0.06)') : 'transparent',
                  color: active ? (cfg?.color ?? '#e8e8e8') : '#555',
                }}>{s === 'all' ? 'All' : cfg!.label}</button>
              );
            })}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#444' }}>{filtered.length} leads</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                  {['Contact', 'Company', 'Title', 'Source', 'Status', 'Score'].map(h => (
                    <th key={h} style={{ padding: '12px', textAlign: 'left', color: '#444', fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#333', fontSize: 13 }}>
                    No leads found. {campaigns.length > 0 ? 'Click "Run Agent" to generate leads.' : 'Import leads via the Import tab.'}
                  </td></tr>
                ) : (
                  filtered.map(lead => <LeadRow key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedLead && <LeadPanel lead={selectedLead} onClose={() => setSelectedLead(null)} onStatusChange={handleStatusChange} />}
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

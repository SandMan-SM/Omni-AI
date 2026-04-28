'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, type Business, type Lead } from '@/lib/agi-supabase';
import {
  Mail, MessageSquare, Phone, Send, Sparkles, Eye, MousePointerClick,
  RefreshCw, ChevronDown, ArrowLeft, Zap, AlertCircle, CheckCircle2, Clock,
  Copy, Edit3, Calendar, Target, BarChart3
} from 'lucide-react';

type OutreachAsset = {
  id: string;
  lead_id: string;
  business_id: string;
  asset_type: 'email' | 'linkedin_dm' | 'voicemail' | 'sms' | 'one_pager';
  touch_number: number;
  send_after_days: number;
  subject: string | null;
  subject_variants: string[] | null;
  body: string;
  status: 'draft' | 'scheduled' | 'sent' | 'opened' | 'replied' | 'bounced';
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  ai_personalization_notes: string | null;
};

const ASSET_ICONS = {
  email: Mail,
  linkedin_dm: MessageSquare,
  voicemail: Phone,
  sms: MessageSquare,
  one_pager: Mail,
} as const;

const STATUS_COLORS: Record<string, string> = {
  draft:     '#94a3b8',
  scheduled: '#facc15',
  sent:      '#38bdf8',
  opened:    '#a78bfa',
  replied:   '#10b981',
  bounced:   '#f87171',
};

function fullName(l: Lead) {
  return [l.first_name, l.last_name].filter(Boolean).join(' ') || '—';
}

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── Credit Meter ─── */
function CreditMeter({ businessId }: { businessId: string }) {
  const [data, setData] = useState<{ used: number; limit: number; remaining: number; reserved: number } | null>(null);

  useEffect(() => {
    fetch(`/api/agi/credits?business_id=${businessId}`)
      .then(r => r.json())
      .then(setData);
  }, [businessId]);

  if (!data) return null;

  const usable = data.limit - data.reserved;
  const pct = Math.min(100, (data.used / usable) * 100);
  const danger = data.used >= usable - 5;

  return (
    <div style={{
      background: '#111', border: `1px solid ${danger ? '#fb923c' : '#1e1e1e'}`,
      borderRadius: 10, padding: '14px 18px', minWidth: 320,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
          Apollo Credits — This Month
        </div>
        <div style={{ fontSize: 12, color: danger ? '#fb923c' : '#94a3b8', fontWeight: 600 }}>
          {data.used} / {usable} used
        </div>
      </div>
      <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          background: danger ? 'linear-gradient(90deg, #fb923c, #f87171)' : 'linear-gradient(90deg, #10b981, #818cf8)',
          height: '100%', borderRadius: 4, transition: 'width 0.6s',
        }} />
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
        {data.remaining - data.reserved} reveals remaining · {data.reserved} reserved for emergencies
      </div>
    </div>
  );
}

/* ─── Asset Card ─── */
function AssetCard({ asset, lead, onSend, onCopy, onRegenerate }: {
  asset: OutreachAsset;
  lead: Lead;
  onSend: (id: string) => void;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
}) {
  const [bodyOverride, setBodyOverride] = useState(asset.body);
  const [subjectIdx, setSubjectIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const Icon = ASSET_ICONS[asset.asset_type];
  const subj = asset.subject_variants?.[subjectIdx] ?? asset.subject;
  const statusColor = STATUS_COLORS[asset.status];

  const isEmail = asset.asset_type === 'email';
  const isLinkedin = asset.asset_type === 'linkedin_dm';
  const isVoicemail = asset.asset_type === 'voicemail';

  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
      padding: 20, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          background: `${statusColor}18`, padding: 8, borderRadius: 8,
          border: `1px solid ${statusColor}30`,
        }}>
          <Icon size={16} color={statusColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8e8', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEmail ? `Email · Touch ${asset.touch_number}` : isLinkedin ? 'LinkedIn DM' : isVoicemail ? 'Voicemail' : asset.asset_type}
            {asset.send_after_days > 0 && (
              <span style={{ fontSize: 10, color: '#555', fontWeight: 500 }}>
                · Day {asset.send_after_days}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            <span style={{ color: statusColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {asset.status}
            </span>
            {asset.sent_at && <span> · sent {timeAgo(asset.sent_at)}</span>}
            {asset.opened_at && <span> · opened {timeAgo(asset.opened_at)}</span>}
            {asset.replied_at && <span> · replied {timeAgo(asset.replied_at)}</span>}
          </div>
        </div>
        <button onClick={() => setEditing(e => !e)} style={iconBtnStyle}>
          <Edit3 size={13} />
        </button>
        <button onClick={() => onCopy(`${subj ? subj + '\n\n' : ''}${bodyOverride}`)} style={iconBtnStyle}>
          <Copy size={13} />
        </button>
      </div>

      {/* Subject line variants (email only) */}
      {isEmail && asset.subject_variants && asset.subject_variants.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
            Subject — A/B variants
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {asset.subject_variants.map((s, i) => (
              <button key={i} onClick={() => setSubjectIdx(i)} style={{
                fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                background: subjectIdx === i ? '#1a2e1e' : '#161616',
                color: subjectIdx === i ? '#10b981' : '#94a3b8',
                border: `1px solid ${subjectIdx === i ? '#10b981' : '#222'}`,
                fontWeight: subjectIdx === i ? 600 : 400,
              }}>
                {String.fromCharCode(65 + i)}: {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {editing ? (
        <textarea
          value={bodyOverride}
          onChange={e => setBodyOverride(e.target.value)}
          style={{
            width: '100%', minHeight: 120, background: '#0a0a0a', border: '1px solid #222',
            borderRadius: 8, padding: 12, color: '#e8e8e8', fontSize: 13, lineHeight: 1.6,
            fontFamily: 'inherit', resize: 'vertical',
          }}
        />
      ) : (
        <div style={{
          background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8,
          padding: 14, fontSize: 13, lineHeight: 1.6, color: '#cbd5e1',
          whiteSpace: 'pre-wrap',
        }}>
          {bodyOverride}
        </div>
      )}

      {asset.ai_personalization_notes && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={11} color="#a78bfa" />
          <em>{asset.ai_personalization_notes}</em>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        {isEmail && asset.status === 'draft' && (
          <button onClick={() => onSend(asset.id)} disabled={!lead.email} style={{
            background: lead.email ? '#10b981' : '#1a1a1a',
            color: lead.email ? '#fff' : '#555',
            border: 'none', padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: lead.email ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Send size={12} /> {lead.email ? 'Send Now' : 'No email — enrich first'}
          </button>
        )}
        {isEmail && asset.status === 'draft' && lead.email && (
          <button style={{
            background: 'transparent', border: '1px solid #222',
            color: '#94a3b8', padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Calendar size={12} /> Schedule
          </button>
        )}
        {isLinkedin && (
          <a href={lead.linkedin_url ?? '#'} target="_blank" rel="noreferrer" style={{
            background: '#1d4ed8', color: '#fff', textDecoration: 'none',
            padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: lead.linkedin_url ? 1 : 0.4, pointerEvents: lead.linkedin_url ? 'auto' : 'none',
          }}>
            <MessageSquare size={12} /> Open LinkedIn → Paste DM
          </a>
        )}
        {isVoicemail && (
          <a href={lead.phone ? `tel:${lead.phone}` : '#'} style={{
            background: '#fb923c', color: '#fff', textDecoration: 'none',
            padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: lead.phone ? 1 : 0.4, pointerEvents: lead.phone ? 'auto' : 'none',
          }}>
            <Phone size={12} /> {lead.phone ? `Call ${lead.phone}` : 'No phone'}
          </a>
        )}
        <button onClick={onRegenerate} style={{
          marginLeft: 'auto', background: 'transparent', border: '1px solid #222',
          color: '#666', padding: '8px 14px', borderRadius: 8,
          fontSize: 11, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={11} /> Regenerate
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: '#161616', border: '1px solid #222', color: '#666',
  padding: 6, borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/* ─── Lead Picker Sidebar ─── */
function LeadSidebar({ leads, selectedId, onSelect, onEnrich }: {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEnrich: (id: string) => void;
}) {
  return (
    <div className="agi-outreach-sidebar" style={{
      width: 320, background: '#0d0d0d', borderRight: '1px solid #1e1e1e',
      height: 'calc(100vh - 60px)', overflowY: 'auto',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
          Leads ({leads.length})
        </div>
      </div>
      {leads.map(l => {
        const active = selectedId === l.id;
        const hasContact = Boolean(l.email || l.phone);
        return (
          <div
            key={l.id}
            onClick={() => onSelect(l.id)}
            style={{
              padding: '14px 20px', cursor: 'pointer',
              background: active ? '#161616' : 'transparent',
              borderLeft: active ? '3px solid #10b981' : '3px solid transparent',
              borderBottom: '1px solid #131313',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fullName(l)}
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.title} · {l.company}
                </div>
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: l.score >= 80 ? '#10b98122' : l.score >= 60 ? '#facc1522' : '#f8717122',
                border: `1.5px solid ${l.score >= 80 ? '#10b981' : l.score >= 60 ? '#facc15' : '#f87171'}`,
                color: l.score >= 80 ? '#10b981' : l.score >= 60 ? '#facc15' : '#f87171',
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{l.score}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {hasContact ? (
                <span style={{ fontSize: 10, color: '#10b981', background: '#0d2a1e', padding: '2px 6px', borderRadius: 4 }}>
                  ✓ Enriched
                </span>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); onEnrich(l.id); }} style={{
                  fontSize: 10, color: '#fb923c', background: '#2a1a0d',
                  border: '1px solid #fb923c40', padding: '2px 6px', borderRadius: 4,
                  cursor: 'pointer',
                }}>
                  ⚡ Enrich (1 credit)
                </button>
              )}
              <span style={{ fontSize: 10, color: '#555' }}>{l.status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─── */
export default function OutreachPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [assets, setAssets] = useState<OutreachAsset[]>([]);
  const [generating, setGenerating] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('omni_active_business_id') : null;
        const found = stored && stored !== 'all' ? data.find(b => b.id === stored) : null;
        setSelectedBiz(found ?? data[0]);
      }
    });
  }, []);

  const loadLeads = useCallback(async (bizId: string) => {
    const { data } = await supabase
      .from('omni_leads_generated')
      .select('*')
      .eq('business_id', bizId)
      .order('score', { ascending: false });
    setLeads(data ?? []);
    if (data?.length && !selectedLeadId) setSelectedLeadId(data[0].id);
  }, [selectedLeadId]);

  useEffect(() => {
    if (selectedBiz) loadLeads(selectedBiz.id);
  }, [selectedBiz, loadLeads]);

  const loadAssets = useCallback(async (leadId: string) => {
    const r = await fetch(`/api/agi/outreach/generate?lead_id=${leadId}`);
    const j = await r.json();
    setAssets(j.assets ?? []);
  }, []);

  useEffect(() => {
    if (selectedLeadId) loadAssets(selectedLeadId);
  }, [selectedLeadId, loadAssets]);

  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null;

  async function handleGenerate() {
    if (!selectedLeadId) return;
    setGenerating(true);
    const r = await fetch('/api/agi/outreach/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: selectedLeadId }),
    });
    const j = await r.json();
    setGenerating(false);
    if (j.ok) {
      showToast('Outreach assets generated');
      await loadAssets(selectedLeadId);
    } else {
      showToast(`Generation failed: ${j.error}`, false);
    }
  }

  async function handleSend(asset_id: string) {
    const r = await fetch('/api/agi/outreach/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id }),
    });
    const j = await r.json();
    if (j.ok) {
      showToast('Email sent');
      if (selectedLeadId) await loadAssets(selectedLeadId);
    } else {
      showToast(`Send failed: ${j.error}`, false);
    }
  }

  async function handleEnrich(lead_id: string) {
    const r = await fetch('/api/agi/leads/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id, business_id: selectedBiz?.id, mock: true }),
    });
    const j = await r.json();
    if (j.ok) {
      showToast('Lead enriched');
      if (selectedBiz) await loadLeads(selectedBiz.id);
    } else {
      showToast(`Enrichment failed: ${j.error}`, false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  }

  // KPIs from current assets
  const stats = {
    total: assets.length,
    sent: assets.filter(a => ['sent', 'opened', 'replied'].includes(a.status)).length,
    opened: assets.filter(a => ['opened', 'replied'].includes(a.status)).length,
    replied: assets.filter(a => a.status === 'replied').length,
  };

  return (
    <div className="agi-outreach-root" style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <style jsx global>{`
        @media (max-width: 900px) {
          /* Stack sidebar above main content on tablet and below */
          .agi-outreach-root .agi-outreach-body {
            flex-direction: column !important;
          }
          .agi-outreach-root .agi-outreach-sidebar {
            width: 100% !important;
            max-height: 240px;
            overflow-y: auto;
            border-right: none !important;
            border-bottom: 1px solid #1e1e1e;
          }
          .agi-outreach-root .agi-outreach-main {
            padding: 16px !important;
            max-width: 100% !important;
          }
          .agi-outreach-root .agi-outreach-lead-card {
            flex-wrap: wrap !important;
            gap: 14px !important;
            padding: 18px !important;
          }
          .agi-outreach-root .agi-outreach-lead-card > div:nth-child(2) {
            min-width: 0;
            flex: 1 1 calc(100% - 76px);
          }
          .agi-outreach-root .agi-outreach-generate-btn {
            width: 100% !important;
            justify-content: center !important;
            order: 99;
            flex: 1 1 100% !important;
          }
          .agi-outreach-root .agi-outreach-stats {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .agi-outreach-root header {
            height: auto !important;
            padding: 12px 16px !important;
            flex-wrap: wrap;
            gap: 10px !important;
          }
        }
      `}</style>
      {/* Header */}
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #10b981, #818cf8)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Outreach Engine</span>
          </div>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBizOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 8, background: '#191919',
              border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e8e8e8',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedBiz?.name ?? 'Select Business'}</span>
              <ChevronDown size={13} color="#555" />
            </button>
            {bizOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6,
                background: '#111', border: '1px solid #222', borderRadius: 10,
                minWidth: 220, zIndex: 10, overflow: 'hidden',
              }}>
                {businesses.map(b => (
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); setSelectedLeadId(null); }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                    background: selectedBiz?.id === b.id ? '#191919' : 'transparent',
                    border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13,
                  }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedBiz && <CreditMeter businessId={selectedBiz.id} />}
        </div>
      </header>

      <div className="agi-outreach-body" style={{ display: 'flex' }}>
        {/* Sidebar */}
        <LeadSidebar
          leads={leads}
          selectedId={selectedLeadId}
          onSelect={setSelectedLeadId}
          onEnrich={handleEnrich}
        />

        {/* Main */}
        <div className="agi-outreach-main" style={{ flex: 1, padding: 32, maxWidth: 800 }}>
          {!selectedLead ? (
            <div style={{ color: '#444', textAlign: 'center', marginTop: 80 }}>
              Pick a lead from the sidebar to start
            </div>
          ) : (
            <>
              {/* Lead header */}
              <div className="agi-outreach-lead-card" style={{
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
                padding: 24, marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 20,
              }}>
                <div className="agi-score-circle agi-score-lg" style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: selectedLead.score >= 80 ? '#10b98122' : '#facc1522',
                  border: `2px solid ${selectedLead.score >= 80 ? '#10b981' : '#facc15'}`,
                  color: selectedLead.score >= 80 ? '#10b981' : '#facc15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, flexShrink: 0,
                }}>{selectedLead.score}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, wordBreak: 'break-word' }}>{fullName(selectedLead)}</div>
                  <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                    {selectedLead.title} · {selectedLead.company}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedLead.email && (
                      <a href={`mailto:${selectedLead.email}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 6,
                        background: '#0a0a0a', border: '1px solid #1e1e1e',
                        color: '#818cf8', fontSize: 11, fontWeight: 600, textDecoration: 'none',
                      }}>📧 Email</a>
                    )}
                    {selectedLead.phone && (
                      <a href={`tel:${selectedLead.phone}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 6,
                        background: '#0a0a0a', border: '1px solid #1e1e1e',
                        color: '#10b981', fontSize: 11, fontWeight: 600, textDecoration: 'none',
                      }}>📱 Phone</a>
                    )}
                    {selectedLead.lead_location && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 6,
                        background: '#0a0a0a', border: '1px solid #1e1e1e',
                        color: '#94a3b8', fontSize: 11, fontWeight: 600,
                      }}>📍 {selectedLead.lead_location}</span>
                    )}
                  </div>
                </div>
                <button className="agi-outreach-generate-btn" onClick={handleGenerate} disabled={generating} style={{
                  background: generating ? '#0d2a1e' : 'linear-gradient(135deg, #10b981, #818cf8)',
                  color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  <Sparkles size={14} />
                  {generating ? 'Generating…' : assets.length > 0 ? 'Regenerate' : 'Generate Outreach'}
                </button>
              </div>

              {/* Stats */}
              {assets.length > 0 && (
                <div className="agi-outreach-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  <StatPill icon={Target} label="Assets" value={stats.total} color="#818cf8" />
                  <StatPill icon={Send} label="Sent" value={stats.sent} color="#38bdf8" />
                  <StatPill icon={Eye} label="Opened" value={stats.opened} color="#a78bfa" />
                  <StatPill icon={CheckCircle2} label="Replied" value={stats.replied} color="#10b981" />
                </div>
              )}

              {/* Assets */}
              {assets.length === 0 ? (
                <div style={{
                  background: '#111', border: '1px dashed #222', borderRadius: 12,
                  padding: 40, textAlign: 'center', color: '#555',
                }}>
                  <Sparkles size={28} color="#333" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>
                    No outreach assets yet
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
                    Click <strong>Generate Outreach</strong> to create a personalized 3-touch email sequence + LinkedIn DM + voicemail script.
                  </div>
                </div>
              ) : (
                <>
                  <SectionLabel>Email Sequence (3 touches)</SectionLabel>
                  {assets.filter(a => a.asset_type === 'email').map(a => (
                    <AssetCard key={a.id} asset={a} lead={selectedLead}
                      onSend={handleSend} onCopy={handleCopy} onRegenerate={handleGenerate} />
                  ))}
                  <SectionLabel>LinkedIn</SectionLabel>
                  {assets.filter(a => a.asset_type === 'linkedin_dm').map(a => (
                    <AssetCard key={a.id} asset={a} lead={selectedLead}
                      onSend={handleSend} onCopy={handleCopy} onRegenerate={handleGenerate} />
                  ))}
                  <SectionLabel>Voicemail</SectionLabel>
                  {assets.filter(a => a.asset_type === 'voicemail').map(a => (
                    <AssetCard key={a.id} asset={a} lead={selectedLead}
                      onSend={handleSend} onCopy={handleCopy} onRegenerate={handleGenerate} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.ok ? '#0d2a1e' : '#2a0d0d',
          border: `1px solid ${toast.ok ? '#10b981' : '#f87171'}`,
          color: toast.ok ? '#10b981' : '#f87171',
          padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
          zIndex: 100,
        }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={12} color={color} />
        <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px',
      fontWeight: 600, margin: '24px 0 12px',
    }}>
      {children}
    </div>
  );
}

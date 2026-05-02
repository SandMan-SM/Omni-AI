'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, type Business, type Lead } from '@/lib/agi-supabase';
import {
  ArrowLeft, ChevronDown, TrendingUp, DollarSign, RefreshCw,
  Trophy, Target, ArrowRight, Sparkles, AlertCircle, CheckCircle2,
  Mail, Phone, MapPin
} from 'lucide-react';

type DealLead = Lead & {
  deal_value?: number;
  deal_stage?: 'lead' | 'contacted' | 'qualified' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  expected_close_date?: string | null;
  ai_score_reasoning?: string | null;
  ai_recommended_angle?: string | null;
};

const STAGES: Array<{ key: DealLead['deal_stage'] & string; label: string; color: string }> = [
  { key: 'lead',          label: 'Lead',          color: '#94a3b8' },
  { key: 'contacted',     label: 'Contacted',     color: '#38bdf8' },
  { key: 'qualified',     label: 'Qualified',     color: '#a78bfa' },
  { key: 'demo',          label: 'Demo',          color: '#facc15' },
  { key: 'proposal',      label: 'Proposal',      color: '#fb923c' },
  { key: 'negotiation',   label: 'Negotiation',   color: '#f87171' },
  { key: 'closed_won',    label: 'Client',        color: '#10b981' },
  { key: 'closed_lost',   label: 'Closed Lost',   color: '#475569' },
];

function fullName(l: DealLead) {
  return [l.first_name, l.last_name].filter(Boolean).join(' ') || '—';
}

function fmtCurrency(cents?: number) {
  if (!cents) return '—';
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

export default function PipelinePage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [leads, setLeads] = useState<DealLead[]>([]);
  const [scoring, setScoring] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editing, setEditing] = useState<DealLead | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        // Default to Omni AI workspace so the agency dashboard shows Omni AI's
        // own pipeline, not the first business alphabetically.
        const stored = typeof window !== 'undefined' ? localStorage.getItem('omni_active_business_id') : null;
        const omniAi = data.find(b => b.name === 'Omni AI');
        const found = stored && stored !== 'all' ? data.find(b => b.id === stored) : null;
        setSelectedBiz(found ?? omniAi ?? data[0]);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedBiz) return;
    const { data } = await supabase
      .from('omni_leads_generated')
      .select('*')
      .eq('business_id', selectedBiz.id)
      .order('score', { ascending: false });
    setLeads((data ?? []) as DealLead[]);
  }, [selectedBiz]);

  useEffect(() => { load(); }, [load]);

  async function moveStage(lead_id: string, new_stage: string) {
    await supabase.from('omni_leads_generated').update({ deal_stage: new_stage }).eq('id', lead_id);
    setLeads(prev => prev.map(l => l.id === lead_id ? { ...l, deal_stage: new_stage as DealLead['deal_stage'] } : l));
    setEditing(prev => prev && prev.id === lead_id ? { ...prev, deal_stage: new_stage as DealLead['deal_stage'] } : prev);
    showToast(`Moved to ${new_stage}`);
  }

  async function updateDealValue(lead_id: string, deal_value: number) {
    await supabase.from('omni_leads_generated').update({ deal_value }).eq('id', lead_id);
    setLeads(prev => prev.map(l => l.id === lead_id ? { ...l, deal_value } : l));
    setEditing(prev => prev && prev.id === lead_id ? { ...prev, deal_value } : prev);
    showToast('Deal value updated');
  }

  async function bulkScore() {
    if (!selectedBiz) return;
    setScoring(true);
    const r = await fetch('/api/agi/leads/bulk-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id, only_unscored: false, max_leads: 25 }),
    });
    const j = await r.json();
    setScoring(false);
    if (j.ok) {
      showToast(`Re-scored ${j.scored} leads with Claude`);
      await load();
    } else {
      showToast(`Failed: ${j.error}`, false);
    }
  }

  // Stage stats
  const byStage: Record<string, DealLead[]> = {};
  for (const stage of STAGES) byStage[stage.key] = [];
  for (const l of leads) {
    const stage = l.deal_stage ?? 'lead';
    if (byStage[stage]) byStage[stage].push(l);
  }

  // Pipeline value (won + open weighted by stage probability)
  const stageProbability: Record<string, number> = {
    lead: 0.05, contacted: 0.1, qualified: 0.25, demo: 0.4,
    proposal: 0.6, negotiation: 0.8, closed_won: 1.0, closed_lost: 0,
  };

  const totalPipeline = leads.reduce((s, l) => {
    if (l.deal_stage === 'closed_lost') return s;
    return s + ((l.deal_value ?? 0) * (stageProbability[l.deal_stage ?? 'lead'] ?? 0.05));
  }, 0);

  const wonRevenue = leads.filter(l => l.deal_stage === 'closed_won').reduce((s, l) => s + (l.deal_value ?? 0), 0);

  // Stuck deals — open stage, idle 14+ days. Surfaces in a banner so the
  // owner sees stalled pipeline at a glance.
  const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
  const stuckLeads = leads.filter(l => {
    if (['closed_won', 'closed_lost'].includes(l.deal_stage ?? '')) return false;
    const ts = (l as DealLead & { updated_at?: string }).updated_at ?? l.created_at;
    return ts && new Date(ts).getTime() <= fourteenDaysAgo;
  });

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Pipeline</span>
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
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#111', border: '1px solid #222', borderRadius: 10, minWidth: 220, zIndex: 10, overflow: 'hidden' }}>
                {businesses.map(b => (
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={bulkScore} disabled={scoring} style={{
            background: scoring ? '#1a1a2e' : '#191919',
            border: '1px solid #a78bfa40', color: '#a78bfa',
            padding: '7px 14px', borderRadius: 8, cursor: scoring ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Sparkles size={11} /> {scoring ? 'Scoring…' : 'AI re-score all'}
          </button>
          <button onClick={load} style={{ background: 'none', border: '1px solid #222', color: '#555', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </header>

      <div style={{ padding: '24px 32px' }}>
        {/* Pipeline value summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <Stat icon={DollarSign} label="Pipeline Value (weighted)" value={fmtCurrency(totalPipeline)} sub="probability-adjusted" color="#a78bfa" />
          <Stat icon={Trophy} label="Client Revenue" value={fmtCurrency(wonRevenue)} sub={`${byStage.closed_won.length} ${byStage.closed_won.length === 1 ? 'client' : 'clients'}`} color="#10b981" />
          <Stat icon={Target} label="Active Deals" value={leads.filter(l => !['closed_won', 'closed_lost'].includes(l.deal_stage ?? 'lead')).length} sub={`${leads.length} total`} color="#38bdf8" />
          <Stat icon={ArrowRight} label="Win Rate" value={`${leads.length > 0 ? Math.round((byStage.closed_won.length / Math.max(byStage.closed_won.length + byStage.closed_lost.length, 1)) * 100) : 0}%`} sub="of closed" color="#facc15" />
        </div>

        {/* Stuck-deals banner */}
        {stuckLeads.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            background: "linear-gradient(135deg, #2a0d0d 0%, #1a0d0d 100%)",
            border: "1px solid #f8717140",
            borderRadius: 10, padding: "12px 16px", marginBottom: 18,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>
                {stuckLeads.length} stuck {stuckLeads.length === 1 ? "deal" : "deals"}
              </div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                Open for 14+ days with no movement — total ${stuckLeads.reduce((s, l) => s + ((l.deal_value ?? 0) / 100), 0).toFixed(0)} sitting idle.
              </div>
            </div>
            <button
              onClick={() => setEditing(stuckLeads[0])}
              style={{
                background: "#f87171", border: "none", color: "#000",
                padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open first
            </button>
          </div>
        )}

        {/* Kanban */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, minmax(200px, 1fr))`, gap: 12, overflowX: 'auto' }}>
          {STAGES.map(stage => (
            <div key={stage.key} style={{
              background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12,
              padding: 12, height: 'calc(100vh - 240px)', minHeight: 400, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${stage.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: stage.color, background: `${stage.color}18`, padding: '2px 8px', borderRadius: 4 }}>
                    {byStage[stage.key].length}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                  {fmtCurrency(byStage[stage.key].reduce((s, l) => s + (l.deal_value ?? 0), 0))}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byStage[stage.key].map(l => (
                  <div key={l.id} onClick={() => setEditing(l)} style={{
                    background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8,
                    padding: 10, cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{fullName(l)}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: l.score >= 80 ? '#10b981' : l.score >= 60 ? '#facc15' : '#f87171',
                        background: '#0a0a0a', padding: '1px 5px', borderRadius: 3,
                      }}>{l.score}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#666', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.company}
                    </div>
                    {l.deal_value ? (
                      <div style={{ fontSize: 11, color: stage.color, fontWeight: 700, marginTop: 6 }}>
                        {fmtCurrency(l.deal_value)}
                      </div>
                    ) : null}
                    {l.ai_recommended_angle && (
                      <div style={{ fontSize: 9, color: '#666', marginTop: 6, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.ai_recommended_angle}
                      </div>
                    )}
                  </div>
                ))}
                {byStage[stage.key].length === 0 && (
                  <div style={{ fontSize: 10, color: '#333', textAlign: 'center', padding: 16 }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lead editor modal */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111', border: '1px solid #1e1e1e', borderRadius: 14,
            padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fullName(editing)}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{editing.title} @ {editing.company}</div>
            </div>

            {/* Contact info */}
            <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Contact</div>
              {editing.email ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mail size={14} color="#555" />
                  <a href={`mailto:${editing.email}`} style={{ fontSize: 13, color: '#818cf8', textDecoration: 'none' }}>{editing.email}</a>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mail size={14} color="#333" />
                  <span style={{ fontSize: 13, color: '#444' }}>No email on file</span>
                </div>
              )}
              {editing.phone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Phone size={14} color="#555" />
                  <a href={`tel:${editing.phone}`} style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>{editing.phone}</a>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Phone size={14} color="#333" />
                  <span style={{ fontSize: 13, color: '#444' }}>No phone on file</span>
                </div>
              )}
              {editing.lead_location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={14} color="#555" />
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{editing.lead_location}</span>
                </div>
              )}
            </div>

            {editing.ai_score_reasoning && (
              <div style={{ background: '#0d2a1e', border: '1px solid #10b98140', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>AI Analysis · Score {editing.score}</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{editing.ai_score_reasoning}</div>
                {editing.ai_recommended_angle && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#facc15', fontStyle: 'italic' }}>
                    Angle: {editing.ai_recommended_angle}
                  </div>
                )}
              </div>
            )}

            <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Stage</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {STAGES.map(s => (
                <button key={s.key} onClick={() => moveStage(editing.id, s.key)} style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  border: `1.5px solid ${editing.deal_stage === s.key ? s.color : '#222'}`,
                  background: editing.deal_stage === s.key ? `${s.color}18` : 'transparent',
                  color: editing.deal_stage === s.key ? s.color : '#666',
                }}>
                  {s.label}
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Deal Value (cents)</label>
            <input
              type="number"
              defaultValue={editing.deal_value ?? 0}
              onBlur={e => updateDealValue(editing.id, parseInt(e.target.value) || 0)}
              style={{
                width: '100%', background: '#0a0a0a', border: '1px solid #222',
                borderRadius: 8, padding: '10px 12px', color: '#e8e8e8', fontSize: 13, marginBottom: 16,
              }}
            />
            <button onClick={() => setEditing(null)} style={{
              width: '100%', background: '#191919', border: '1px solid #222',
              color: '#94a3b8', padding: 12, borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Done
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.ok ? '#0d2a1e' : '#2a0d0d',
          border: `1px solid ${toast.ok ? '#10b981' : '#f87171'}`,
          color: toast.ok ? '#10b981' : '#f87171',
          padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ background: `${color}18`, padding: 6, borderRadius: 6 }}>
          <Icon size={13} color={color} />
        </div>
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Business, type Campaign } from '@/lib/agi-supabase';
import {
  ArrowLeft, ChevronDown, Target, Plus, Edit3, Trash2, Save,
  X, CheckCircle2, Pause, Play, Briefcase, MapPin, Tag
} from 'lucide-react';

type ICP = {
  titles?: string[];
  industries?: string[];
  location?: string;
  keywords?: string[];
  seniorities?: string[];
};

export default function CampaignsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (!data?.length) return;
      setBusinesses(data);
      // Honor the pinned workspace so client viewers (Sammy, Jaime, Brent,
      // Adam) land on their own tenant instead of whoever's alphabetical
      // first. Falls through to data[0] if no pin or pin doesn't match.
      let initial: any = null;
      try {
        if (typeof window !== "undefined") {
          const pinned = localStorage.getItem("omni_active_business_id");
          if (pinned && pinned !== "all") {
            initial = data.find((b: any) => b.id === pinned) ?? null;
          }
        }
      } catch {}
      setSelectedBiz(initial ?? data[0]);
    });
  }, []);

  // Live workspace switcher / auto-pin sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== 'omni_active_business_id') return;
      const v = ev.newValue;
      if (!v || v === 'all') return;
      const found = businesses.find(b => b.id === v);
      if (found) setSelectedBiz(found);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  useEffect(() => {
    if (!selectedBiz) return;
    fetch(`/api/agi/campaigns?business_id=${selectedBiz.id}`).then(r => r.json()).then(j => setCampaigns(j.campaigns ?? []));
  }, [selectedBiz]);

  async function handleSave(c: Partial<Campaign>) {
    const isNew = !c.id;
    const r = await fetch('/api/agi/campaigns', {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isNew ? { ...c, business_id: selectedBiz?.id } : c),
    });
    const j = await r.json();
    if (j.campaign) {
      showToast(isNew ? 'Campaign created' : 'Campaign updated');
      if (selectedBiz) {
        const r2 = await fetch(`/api/agi/campaigns?business_id=${selectedBiz.id}`);
        const j2 = await r2.json();
        setCampaigns(j2.campaigns ?? []);
      }
      setEditing(null);
      setCreating(false);
    } else {
      showToast(j.error ?? 'Save failed', false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign? Leads will remain but lose campaign association.')) return;
    await fetch(`/api/agi/campaigns?id=${id}`, { method: 'DELETE' });
    setCampaigns(prev => prev.filter(c => c.id !== id));
    showToast('Campaign deleted');
  }

  async function toggleStatus(c: Campaign) {
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    await fetch('/api/agi/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, status: newStatus }),
    });
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus as Campaign['status'] } : x));
  }

  // Privacy: filter businesses dropdown so non-admin client viewers
  // can't see (or click into) other tenants' workspaces.
  const visibleBizs = (() => {
    try {
      if (typeof window === "undefined") return businesses;
      const u = JSON.parse(localStorage.getItem("omni_user") || "null");
      if (u?.is_admin) return businesses;
      return selectedBiz ? [selectedBiz] : [];
    } catch { return businesses; }
  })();

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={14} color="#fb923c" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Campaigns</span>
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
                {visibleBizs.map(b => (
                  <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => setCreating(true)} style={{
          background: '#10b981', color: '#fff', border: 'none',
          padding: '8px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={13} /> New Campaign
        </button>
      </header>

      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        {creating && (
          <CampaignEditor
            campaign={null}
            onSave={handleSave}
            onCancel={() => setCreating(false)}
          />
        )}

        {campaigns.length === 0 && !creating ? (
          <div style={{
            background: '#111', border: '1px dashed #222', borderRadius: 12,
            padding: 60, textAlign: 'center',
          }}>
            <Target size={36} color="#333" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>No campaigns yet</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
              Create a campaign to define an ICP. Imports and outreach can be linked to a campaign for tracking.
            </div>
            <button onClick={() => setCreating(true)} style={{
              marginTop: 20, background: '#10b981', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              + Create your first campaign
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {campaigns.map(c => (
              editing?.id === c.id ? (
                <CampaignEditor
                  key={c.id}
                  campaign={c}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onEdit={() => setEditing(c)}
                  onDelete={() => handleDelete(c.id)}
                  onToggle={() => toggleStatus(c)}
                />
              )
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.ok ? '#0d2a1e' : '#2a0d0d',
          border: `1px solid ${toast.ok ? '#10b981' : '#f87171'}`,
          color: toast.ok ? '#10b981' : '#f87171',
          padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, onEdit, onDelete, onToggle }: {
  campaign: Campaign;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const icp = (campaign.icp as ICP) ?? {};
  const target = campaign.leads_target ?? 0;
  const generated = campaign.leads_generated ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((generated / target) * 100)) : 0;
  const active = campaign.status === 'active';

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{campaign.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: active ? '#10b981' : '#fb923c',
              background: active ? '#0d2a1e' : '#2a1a0d',
              padding: '2px 8px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {campaign.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {generated} / {target} leads · {pct}% to target
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onToggle} style={iconBtn}>
            {active ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button onClick={onEdit} style={iconBtn}><Edit3 size={13} /></button>
          <button onClick={onDelete} style={{ ...iconBtn, color: '#f87171', borderColor: '#f8717140' }}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Progress */}
      <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #818cf8)', height: '100%', borderRadius: 4 }} />
      </div>

      {/* ICP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {icp.titles && icp.titles.length > 0 && (
          <ICPField icon={Briefcase} label="Titles" values={icp.titles} color="#818cf8" />
        )}
        {icp.location && (
          <ICPField icon={MapPin} label="Location" values={[icp.location]} color="#fb923c" />
        )}
        {icp.industries && icp.industries.length > 0 && (
          <ICPField icon={Tag} label="Industries" values={icp.industries} color="#10b981" />
        )}
        {icp.seniorities && icp.seniorities.length > 0 && (
          <ICPField icon={CheckCircle2} label="Seniorities" values={icp.seniorities} color="#a78bfa" />
        )}
      </div>
    </div>
  );
}

function ICPField({ icon: Icon, label, values, color }: { icon: React.ElementType; label: string; values: string[]; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {values.map(v => (
          <span key={v} style={{ fontSize: 11, background: `${color}15`, color, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function CampaignEditor({ campaign, onSave, onCancel }: {
  campaign: Campaign | null;
  onSave: (c: Partial<Campaign>) => void;
  onCancel: () => void;
}) {
  const initialIcp = (campaign?.icp as ICP) ?? {};
  const [name, setName] = useState(campaign?.name ?? '');
  const [target, setTarget] = useState(campaign?.leads_target ?? 100);
  const [titles, setTitles] = useState((initialIcp.titles ?? []).join(', '));
  const [industries, setIndustries] = useState((initialIcp.industries ?? []).join(', '));
  const [location, setLocation] = useState(initialIcp.location ?? '');
  const [keywords, setKeywords] = useState((initialIcp.keywords ?? []).join(', '));
  const [seniorities, setSeniorities] = useState(initialIcp.seniorities ?? []);

  const SENIORITY_OPTIONS = ['c_suite', 'vp', 'head', 'director', 'manager', 'senior'];

  function toggleSeniority(s: string) {
    setSeniorities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function handleSave() {
    const icp: ICP = {
      titles: titles.split(',').map(s => s.trim()).filter(Boolean),
      industries: industries.split(',').map(s => s.trim()).filter(Boolean),
      keywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
      seniorities,
      location: location.trim() || undefined,
    };
    onSave({
      ...(campaign?.id ? { id: campaign.id } : {}),
      name, leads_target: target, icp,
    });
  }

  return (
    <div style={{
      background: '#111', border: '1.5px solid #10b981', borderRadius: 12, padding: 24, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{campaign ? 'Edit Campaign' : 'New Campaign'}</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
        <Field label="Campaign name" value={name} onChange={setName} placeholder="Q2 Las Vegas Wellness Buyers" />
        <Field label="Lead target" value={String(target)} onChange={v => setTarget(parseInt(v) || 100)} placeholder="100" />
      </div>

      <Field label="Titles (comma-separated)" value={titles} onChange={setTitles} placeholder="HR Director, Benefits Manager, COO" />
      <Field label="Industries" value={industries} onChange={setIndustries} placeholder="Technology, Finance, Healthcare" />
      <Field label="Location" value={location} onChange={setLocation} placeholder="Las Vegas, NV" />
      <Field label="Keywords" value={keywords} onChange={setKeywords} placeholder="wellness, employee benefits, growing team" />

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Seniorities</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SENIORITY_OPTIONS.map(s => {
            const active = seniorities.includes(s);
            return (
              <button key={s} onClick={() => toggleSeniority(s)} style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', textTransform: 'capitalize',
                border: `1.5px solid ${active ? '#10b981' : '#222'}`,
                background: active ? '#0d2a1e' : 'transparent',
                color: active ? '#10b981' : '#666',
              }}>
                {s.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: '1px solid #222',
          color: '#94a3b8', padding: '10px 18px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={handleSave} disabled={!name} style={{
          background: name ? '#10b981' : '#0d2a1e',
          color: name ? '#fff' : '#10b981', border: 'none',
          padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 700,
          cursor: name ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Save size={13} /> {campaign ? 'Update' : 'Create'} Campaign
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: '#0a0a0a', border: '1px solid #222',
          borderRadius: 8, padding: '10px 12px', color: '#e8e8e8', fontSize: 13,
        }}
      />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: '#161616', border: '1px solid #222', color: '#666',
  padding: 8, borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

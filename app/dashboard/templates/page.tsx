'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { authFetch } from '@/lib/auth';
import {
  ArrowLeft, ChevronDown, BookOpen, Sparkles, CheckCircle2,
  AlertCircle, Briefcase, MapPin, Tag, ArrowRight, Zap
} from 'lucide-react';

type Template = {
  id: string;
  name: string;
  industry: string | null;
  vertical: string | null;
  description: string | null;
  icp_template: { titles?: string[]; industries?: string[]; seniorities?: string[]; location?: string };
  tone: string | null;
  use_count: number;
};

const INDUSTRY_COLORS: Record<string, string> = {
  Roofing: '#fb923c',
  'Health & Wellness': '#10b981',
  Software: '#a78bfa',
  Marketing: '#38bdf8',
  Finance: '#facc15',
};

export default function TemplatesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
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
    // Templates GET is intentionally public (returns only is_public=true).
    fetch('/api/agi/templates')
      .then(r => (r.ok ? r.json() : null))
      .then(j => setTemplates(Array.isArray(j?.templates) ? j.templates : []))
      .catch(() => {});
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

  async function handleApply(template_id: string) {
    if (!selectedBiz) return;
    setApplying(template_id);
    // POST is auth-gated — forward bearer.
    const r = await authFetch('/api/agi/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id, business_id: selectedBiz.id }),
    });
    const j = await r.json().catch(() => ({}));
    setApplying(null);
    if (j.ok) {
      showToast(`Campaign "${j.campaign.name}" created`);
    } else {
      showToast(`Failed: ${j.error || `HTTP ${r.status}`}`, false);
    }
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
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={14} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Sequence Templates</span>
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
      </header>

      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={18} color="#facc15" />
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Pre-built playbooks</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              Battle-tested ICP configs by industry. Click <strong>Apply</strong> to create a campaign with that targeting.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {templates.map(t => {
            const color = INDUSTRY_COLORS[t.industry ?? ''] ?? '#94a3b8';
            const isApplying = applying === t.id;
            return (
              <div key={t.id} style={{
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 700,
                      color, background: `${color}18`,
                      padding: '3px 10px', borderRadius: 4, marginBottom: 8,
                      letterSpacing: '0.5px', textTransform: 'uppercase',
                    }}>{t.industry}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{t.name}</h3>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 1.6 }}>{t.description}</p>
                  </div>
                </div>

                {/* ICP preview */}
                <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: 12 }}>
                  {t.icp_template?.titles && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Briefcase size={10} color="#666" />
                        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Titles</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {t.icp_template.titles.slice(0, 4).map(x => (
                          <span key={x} style={{ fontSize: 10, background: '#1a1a1a', color: '#94a3b8', padding: '2px 8px', borderRadius: 4 }}>{x}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.icp_template?.industries && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Tag size={10} color="#666" />
                        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Industries</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {t.icp_template.industries.slice(0, 4).map(x => (
                          <span key={x} style={{ fontSize: 10, background: '#1a1a1a', color: '#94a3b8', padding: '2px 8px', borderRadius: 4 }}>{x}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: 11, color: '#555' }}>Used {t.use_count} times</span>
                  <button
                    onClick={() => handleApply(t.id)}
                    disabled={isApplying || !selectedBiz}
                    style={{
                      background: selectedBiz ? `${color}30` : '#1a1a1a',
                      border: `1px solid ${selectedBiz ? color : '#222'}`,
                      color: selectedBiz ? color : '#555',
                      padding: '8px 16px', borderRadius: 8,
                      fontSize: 12, fontWeight: 700,
                      cursor: selectedBiz && !isApplying ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Zap size={11} /> {isApplying ? 'Applying…' : 'Apply'} <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

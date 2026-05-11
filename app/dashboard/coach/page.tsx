'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { loadBusinesses } from '@/lib/dashboard-businesses';
import { authFetch } from '@/lib/auth';
import { ArrowLeft, ChevronDown, Brain, Sparkles, RefreshCw, CheckCircle2, X, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';

type Recommendation = {
  id: string;
  lead_id: string | null;
  recommendation_type: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  rationale: string | null;
  suggested_action: Record<string, string> | null;
  acted_on: boolean;
  created_at: string;
  lead?: {
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    title: string | null;
    score: number | null;
  } | null;
};

const TYPE_ICONS = { next_action: ArrowRight, risk_alert: AlertTriangle, opportunity: TrendingUp };
const PRIORITY_COLORS: Record<string, string> = { high: '#f87171', medium: '#facc15', low: '#94a3b8' };

export default function CoachPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => {
    loadBusinesses().then(({ data }) => {
      if (!data?.length) return;
      setBusinesses(data);
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

  // Drop stale responses if the user switches workspace mid-flight.
  const selectedBizRef = useRef<string | null>(null);
  useEffect(() => { selectedBizRef.current = selectedBiz?.id ?? null; }, [selectedBiz]);

  const load = useCallback(async () => {
    if (!selectedBiz) return;
    const requestedBizId = selectedBiz.id;
    setRecs([]);
    // authFetch forwards the omni_token bearer so the gated endpoint
    // accepts the call even when cookies are blocked. Cookie auth still
    // works on its own; the bearer is defense-in-depth.
    const r = await authFetch(`/api/agi/coach/recommendations?business_id=${requestedBizId}`);
    if (selectedBizRef.current !== requestedBizId) return;
    if (!r.ok) {
      console.error('[coach] load failed:', r.status);
      return;
    }
    const j = await r.json();
    if (selectedBizRef.current !== requestedBizId) return;
    setRecs(Array.isArray(j?.recommendations) ? j.recommendations : []);
  }, [selectedBiz]);

  useEffect(() => { load(); }, [load]);

  async function regenerate() {
    if (!selectedBiz) return;
    setGenerating(true);
    const r = await authFetch('/api/agi/coach/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id }),
    });
    const j = await r.json().catch(() => ({}));
    setGenerating(false);
    if (j.ok) {
      showToast(`Generated ${j.count} recommendations`);
      load();
    } else {
      showToast(`Failed: ${j.error || `HTTP ${r.status}`}`);
    }
  }

  async function dismiss(id: string) {
    await authFetch('/api/agi/coach/recommendations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dismissed: true }),
    });
    setRecs(prev => prev.filter(r => r.id !== id));
  }

  async function markActed(id: string) {
    await authFetch('/api/agi/coach/recommendations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, acted_on: true }),
    });
    setRecs(prev => prev.filter(r => r.id !== id));
    showToast('Marked done');
  }

  // Sort: high first
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...recs].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

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
            <Brain size={14} color="#a78bfa" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>AI Deal Coach</span>
            {recs.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', background: '#1a1a2e', padding: '2px 8px', borderRadius: 4 }}>
                {recs.length}
              </span>
            )}
          </div>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setBizOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#191919', border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e8e8e8' }}>
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
        <button onClick={regenerate} disabled={generating} style={{
          background: generating ? '#1a1a2e' : 'linear-gradient(135deg, #a78bfa, #818cf8)',
          color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Sparkles size={13} /> {generating ? 'Analyzing…' : 'Regenerate Coach Recommendations'}
        </button>
      </header>

      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        {sorted.length === 0 ? (
          <div style={{ background: '#111', border: '1px dashed #222', borderRadius: 14, padding: 60, textAlign: 'center' }}>
            <Brain size={36} color="#333" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>No recommendations yet</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
              Click <strong>Regenerate</strong> to have the AI coach analyze your pipeline and surface the highest-leverage actions.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map(r => {
              const Icon = TYPE_ICONS[r.recommendation_type as keyof typeof TYPE_ICONS] ?? Sparkles;
              const color = PRIORITY_COLORS[r.priority];
              return (
                <div key={r.id} style={{
                  background: '#111', border: `1.5px solid ${r.priority === 'high' ? color : '#1e1e1e'}`,
                  borderRadius: 12, padding: 20, display: 'flex', gap: 16,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${color}18`, border: `1px solid ${color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase',
                        background: `${color}18`, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.5px',
                      }}>
                        {r.priority}
                      </span>
                      <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {r.recommendation_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>
                      {r.recommendation}
                    </div>
                    {r.rationale && (
                      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>
                        {r.rationale}
                      </div>
                    )}
                    {r.lead && (
                      <div style={{ fontSize: 11, color: '#666' }}>
                        🎯 {r.lead.first_name} {r.lead.last_name} · {r.lead.title} @ {r.lead.company} · score {r.lead.score}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => markActed(r.id)} style={{
                      background: '#10b981', color: '#fff', border: 'none',
                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <CheckCircle2 size={11} /> Done
                    </button>
                    <button onClick={() => dismiss(r.id)} style={{
                      background: 'transparent', color: '#666', border: '1px solid #222',
                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <X size={11} /> Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#0d2a1e', border: '1px solid #10b981', color: '#10b981',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        }}>{toast}</div>
      )}
    </div>
  );
}

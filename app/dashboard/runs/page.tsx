'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { loadBusinesses } from '@/lib/dashboard-businesses';
import { authFetch } from '@/lib/auth';
import { ArrowLeft, ChevronDown, Activity, RefreshCw, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

type Run = {
  id: string;
  run_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_pct: number;
  progress_message: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const STATUS_CFG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending:   { color: '#94a3b8', icon: Clock,        label: 'Pending'   },
  running:   { color: '#facc15', icon: Activity,     label: 'Running'   },
  completed: { color: '#10b981', icon: CheckCircle2, label: 'Completed' },
  failed:    { color: '#f87171', icon: XCircle,      label: 'Failed'    },
};

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RunsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);

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
    setRuns([]);
    // authFetch + tolerate non-2xx so the polling loop doesn't crash
    // on a transient 401.
    const r = await authFetch(`/api/agi/runs?business_id=${requestedBizId}`);
    if (selectedBizRef.current !== requestedBizId) return;
    if (!r.ok) {
      console.error('[runs] load failed:', r.status);
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (selectedBizRef.current !== requestedBizId) return;
    setRuns(Array.isArray(j?.runs) ? j.runs : []);
  }, [selectedBiz]);

  useEffect(() => { load(); }, [load]);

  // Live refresh every 5s while there are running tasks
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'pending' || r.status === 'running');
    if (!hasRunning) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [runs, load]);

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
          <Zap size={14} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Agent Runs</span>
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
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #222', color: '#555', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        {runs.length === 0 ? (
          <div style={{ background: '#111', border: '1px dashed #222', borderRadius: 14, padding: 60, textAlign: 'center' }}>
            <Zap size={28} color="#333" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>No agent runs yet</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>Long-running tasks (autopilot, bulk ops) appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {runs.map(r => {
              const cfg = STATUS_CFG[r.status];
              const Icon = cfg.icon;
              return (
                <div key={r.id} style={{
                  background: '#111', border: `1px solid ${r.status === 'running' ? cfg.color : '#1e1e1e'}`,
                  borderRadius: 12, padding: 18,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: `${cfg.color}18`, padding: 6, borderRadius: 6 }}>
                        <Icon size={14} color={cfg.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8e8' }}>{r.run_type}</div>
                        <div style={{ fontSize: 10, color: '#666' }}>{timeAgo(r.created_at)}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: `${cfg.color}18`, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {cfg.label}
                    </span>
                  </div>
                  {r.status === 'running' && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ background: '#0a0a0a', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${r.progress_pct}%`, background: cfg.color, height: '100%', transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{r.progress_pct}% · {r.progress_message ?? ''}</div>
                    </div>
                  )}
                  {r.error && (
                    <div style={{ fontSize: 11, color: '#f87171', background: '#2a0d0d', padding: 8, borderRadius: 6, marginTop: 6 }}>
                      ❌ {r.error}
                    </div>
                  )}
                  {r.result && r.status === 'completed' && (
                    <pre style={{ fontSize: 10, color: '#666', background: '#0a0a0a', padding: 8, borderRadius: 6, marginTop: 6, overflow: 'auto', maxHeight: 80 }}>
                      {JSON.stringify(r.result, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

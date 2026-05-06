'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { authFetch } from '@/lib/auth';
import { ArrowLeft, ChevronDown, Activity, MapPin, Building2, Briefcase, Target, RefreshCw } from 'lucide-react';

type Bucket = { key: string; count: number; qualified: number; value: number; avg_score: number };

type Heatmap = {
  by_location: Bucket[];
  by_company: Bucket[];
  by_title: Bucket[];
  by_stage: Bucket[];
  total: number;
};

export default function HeatmapPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);

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

  // Drop stale responses if the user switches workspace mid-flight.
  const selectedBizRef = useRef<string | null>(null);
  useEffect(() => { selectedBizRef.current = selectedBiz?.id ?? null; }, [selectedBiz]);

  const load = useCallback(async () => {
    if (!selectedBiz) return;
    const requestedBizId = selectedBiz.id;
    // authFetch forwards the omni_token bearer so the now-gated
    // /api/agi/heatmap endpoint accepts the call even when cookies
    // are blocked (Safari ITP, third-party-cookie restrictions, etc.).
    // Cookie auth still works on its own; the bearer is defense-in-depth.
    const r = await authFetch(`/api/agi/heatmap?business_id=${requestedBizId}`);
    if (selectedBizRef.current !== requestedBizId) return;
    if (!r.ok) {
      console.error('[heatmap] load failed:', r.status);
      setHeatmap(null);
      return;
    }
    const j = await r.json();
    if (selectedBizRef.current !== requestedBizId) return;
    // Defensive: 200 with `{error: ...}` shouldn't crash the rendering
    // path that expects by_location / by_company / by_title / by_stage.
    if (!j || typeof j !== 'object' || !Array.isArray(j.by_location)) {
      console.error('[heatmap] unexpected shape:', j);
      setHeatmap(null);
      return;
    }
    setHeatmap(j);
  }, [selectedBiz]);

  useEffect(() => { load(); }, [load]);

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
          <Activity size={14} color="#a78bfa" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Heatmap</span>
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

      <div className="agi-heatmap-content" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        {!heatmap ? (
          <div style={{ color: '#444', textAlign: 'center', padding: 60 }}>Loading…</div>
        ) : (
          <>
            <div style={{ marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
              Density across <strong>{heatmap.total} leads</strong> for {selectedBiz?.name}.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Cluster icon={MapPin} title="By Location" color="#fb923c" buckets={heatmap.by_location.slice(0, 12)} total={heatmap.total} />
              <Cluster icon={Briefcase} title="By Title" color="#818cf8" buckets={heatmap.by_title.slice(0, 12)} total={heatmap.total} />
              <Cluster icon={Building2} title="By Company" color="#a78bfa" buckets={heatmap.by_company.slice(0, 12)} total={heatmap.total} />
              <Cluster icon={Target} title="By Pipeline Stage" color="#10b981" buckets={heatmap.by_stage} total={heatmap.total} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Cluster({ icon: Icon, title, color, buckets, total }: {
  icon: React.ElementType; title: string; color: string; buckets: Bucket[]; total: number;
}) {
  const max = Math.max(...buckets.map(b => b.count), 1);
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon size={14} color={color} />
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>{title}</h3>
      </div>
      {buckets.length === 0 ? (
        <div style={{ color: '#444', fontSize: 12, padding: 16, textAlign: 'center' }}>No data</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {buckets.map(b => {
            const pct = (b.count / max) * 100;
            const sharePct = total > 0 ? Math.round((b.count / total) * 100) : 0;
            return (
              <div key={b.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                    {b.key}
                  </span>
                  <span style={{ color, fontWeight: 700 }}>
                    {b.count} <span style={{ color: '#555', fontWeight: 400 }}>· {sharePct}%</span>
                  </span>
                </div>
                <div style={{ background: '#0a0a0a', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 3 }} />
                </div>
                {b.qualified > 0 && (
                  <div style={{ fontSize: 9, color: '#10b981', marginTop: 2 }}>
                    {b.qualified} qualified · avg score {b.avg_score}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

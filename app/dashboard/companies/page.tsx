'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { loadBusinesses } from '@/lib/dashboard-businesses';
import { authFetch } from '@/lib/auth';
import {
  ArrowLeft, ChevronDown, Building2, Sparkles, Users, MapPin, Calendar,
  TrendingUp, Briefcase, Cpu, RefreshCw, ExternalLink
} from 'lucide-react';
import { AgiBusinessAdvancement } from '@/components/agi/AgiBusinessAdvancement';

type CompanyIntel = {
  id: string;
  domain: string;
  name: string | null;
  industry: string | null;
  short_description: string | null;
  founded_year: number | null;
  estimated_num_employees: number | null;
  city: string | null;
  state: string | null;
  linkedin_url: string | null;
  technology_names: string[] | null;
  keywords: string[] | null;
  departmental_head_count: Record<string, number> | null;
  latest_funding_stage: string | null;
  latest_funding_date: string | null;
  enriched_at: string;
};

export default function CompaniesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [companies, setCompanies] = useState<CompanyIntel[]>([]);
  const [bizOpen, setBizOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [selected, setSelected] = useState<CompanyIntel | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadBusinesses().then(({ data, isAdmin: admin }) => {
      setIsAdmin(admin);
      if (data?.length) {
        setBusinesses(data);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('omni_active_business_id') : null;
        const found = stored && stored !== 'all' ? data.find(b => b.id === stored) : null;
        setSelectedBiz(found ?? data[0]);
      }
    });
  }, []);

  // Sync with workspace switcher (and AgiAdminPanel auto-pin synthetic event).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== 'omni_active_business_id') return;
      const v = ev.newValue;
      if (!v || v === 'all') return; // Companies is per-business; ignore "all"
      const found = businesses.find(b => b.id === v);
      if (found) { setSelectedBiz(found); setSelected(null); }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  // Drop stale responses if the user switches workspace mid-flight.
  const selectedBizRef = useRef<string | null>(null);
  useEffect(() => { selectedBizRef.current = selectedBiz?.id ?? null; }, [selectedBiz]);

  useEffect(() => {
    if (!selectedBiz) return;
    const requestedBizId = selectedBiz.id;
    setCompanies([]);
    // authFetch + tolerate non-2xx so a 401 doesn't crash the destructure.
    authFetch(`/api/agi/companies?business_id=${requestedBizId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (selectedBizRef.current !== requestedBizId) return;
        const list = Array.isArray(j?.companies) ? j.companies : [];
        setCompanies(list);
        if (list.length && !selected) setSelected(list[0]);
      })
      .catch(() => {});
  }, [selectedBiz, selected]);

  async function handleEnrich() {
    if (!domain || !selectedBiz) return;
    setEnriching(true);
    setToast(null);

    // Note: in production, you'd call Apollo MCP via a server-side flow.
    // For now, we display a hint that the user should run it via the dashboard.
    setToast('Apollo enrichment runs server-side. The Prime IV demo entry shows what enrichment yields.');
    setEnriching(false);
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Privacy: filter businesses dropdown so non-admin client viewers
  // can't see (or click into) other tenants' workspaces.
  const visibleBizs = (() => {
    try {
      if (isAdmin) return businesses;
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
          <Building2 size={14} color="#a78bfa" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Company Intel</span>
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
                <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); setSelected(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: selectedBiz?.id === b.id ? '#191919' : 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Per-business advancement panel — pipeline KPIs across every dashboard
          tenant so admins see how each business is growing at a glance. */}
      <div style={{ padding: '16px 20px 0' }}>
        <AgiBusinessAdvancement />
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar list */}
        <div style={{ width: 320, background: '#0d0d0d', borderRight: '1px solid #1e1e1e', height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Enrich a company (FREE — no Apollo credits)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="domain.com"
                style={{ flex: 1, background: '#0a0a0a', border: '1px solid #222', borderRadius: 6, padding: '8px 10px', color: '#e8e8e8', fontSize: 12 }}
              />
              <button onClick={handleEnrich} disabled={!domain || enriching} style={{
                background: domain ? '#10b981' : '#1a1a1a', color: domain ? '#fff' : '#555',
                border: 'none', padding: '8px 12px', borderRadius: 6,
                fontSize: 12, fontWeight: 700, cursor: domain ? 'pointer' : 'not-allowed',
              }}>
                <Sparkles size={11} />
              </button>
            </div>
          </div>
          <div style={{ padding: '12px 20px', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            {companies.length} enriched
          </div>
          {companies.map(c => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              style={{
                padding: '14px 20px', cursor: 'pointer',
                background: selected?.id === c.id ? '#161616' : 'transparent',
                borderLeft: selected?.id === c.id ? '3px solid #a78bfa' : '3px solid transparent',
                borderBottom: '1px solid #131313',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                {c.industry} · {c.estimated_num_employees ? `${c.estimated_num_employees} emp` : ''}
              </div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>{c.domain}</div>
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: 32, maxWidth: 900 }}>
          {!selected ? (
            <div style={{ color: '#444', textAlign: 'center', marginTop: 80 }}>
              Pick a company from the sidebar to view enriched intel
            </div>
          ) : (
            <>
              <div style={{
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
                padding: 28, marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Building2 size={26} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{selected.industry}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 4, display: 'flex', gap: 12 }}>
                      <span>🌐 {selected.domain}</span>
                      {selected.linkedin_url && <a href={selected.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>↗ LinkedIn</a>}
                    </div>
                  </div>
                </div>
                {selected.short_description && (
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: '#cbd5e1', marginTop: 12 }}>
                    {selected.short_description}
                  </p>
                )}
              </div>

              {/* Quick stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <Stat icon={Users} label="Employees" value={selected.estimated_num_employees?.toLocaleString() ?? '—'} color="#10b981" />
                <Stat icon={Calendar} label="Founded" value={selected.founded_year?.toString() ?? '—'} color="#818cf8" />
                <Stat icon={MapPin} label="HQ" value={[selected.city, selected.state].filter(Boolean).join(', ') || '—'} color="#fb923c" />
                <Stat icon={TrendingUp} label="Last Funding" value={selected.latest_funding_stage ?? 'None'} color="#facc15" />
              </div>

              {/* Departments */}
              {selected.departmental_head_count && (
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Briefcase size={14} color="#10b981" />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Departmental Headcount</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {Object.entries(selected.departmental_head_count)
                      .filter(([, v]) => v > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([dept, count]) => (
                        <div key={dept} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{count}</div>
                          <div style={{ fontSize: 10, color: '#555', textTransform: 'capitalize' }}>{dept.replace(/_/g, ' ')}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tech stack */}
              {selected.technology_names && selected.technology_names.length > 0 && (
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Cpu size={14} color="#a78bfa" />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Tech Stack</h3>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.technology_names.map(t => (
                      <span key={t} style={{ background: '#1a1a2e', color: '#a78bfa', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {selected.keywords && selected.keywords.length > 0 && (
                <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Keyword Signals</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.keywords.slice(0, 20).map(k => (
                      <span key={k} style={{ background: '#161616', color: '#94a3b8', padding: '3px 8px', borderRadius: 4, fontSize: 10 }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#1a1a2e', border: '1px solid #a78bfa',
          color: '#a78bfa', padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
        }}>{toast}</div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8e8' }}>{value}</div>
    </div>
  );
}

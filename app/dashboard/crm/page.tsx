'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth';
import {
  Users, Building2, Sparkles, RefreshCw, Search, Filter, Mail, Phone,
  ArrowLeft, Inbox,
} from 'lucide-react';

type CrmLead = {
  business: string;
  table: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  utm_source: string;
  referrer: string;
  created_at: string | null;
};

type CrmStats = {
  total: number;
  businesses: number;
  newThisWeek: number;
  byBusiness: Record<string, number>;
  byStatus: Record<string, number>;
};

const STATUS_COLOR: Record<string, string> = {
  new: '#818cf8', contacted: '#38bdf8', qualified: '#10b981',
  converted: '#4ade80', lost: '#f87171', subscribed: '#4ade80',
};

function statusColor(s: string) {
  return STATUS_COLOR[s?.toLowerCase()] || '#94a3b8';
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (!t) return '—';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 150 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#f4f4f5' }}>{value}</div>
    </div>
  );
}

export default function CrmPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [biz, setBiz] = useState('all');
  const [status, setStatus] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    authFetch('/api/dashboard/crm')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => { setLeads(j.leads || []); setStats(j.stats || null); })
      .catch((e) => setErr(e.message === '401' || e.message === '403' ? 'Sign in as an admin to view the CRM.' : 'Could not load CRM data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const businesses = useMemo(() => {
    const b = stats ? Object.entries(stats.byBusiness).sort((a, c) => c[1] - a[1]) : [];
    return b;
  }, [stats]);

  const statuses = useMemo(() => (stats ? Object.keys(stats.byStatus) : []), [stats]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (biz !== 'all' && l.business !== biz) return false;
      if (status !== 'all' && (l.status || '').toLowerCase() !== status.toLowerCase()) return false;
      if (!needle) return true;
      return (
        l.name.toLowerCase().includes(needle) ||
        l.email.toLowerCase().includes(needle) ||
        l.phone.toLowerCase().includes(needle) ||
        l.business.toLowerCase().includes(needle) ||
        l.source.toLowerCase().includes(needle)
      );
    });
  }, [leads, q, biz, status]);

  const sel = { background: '#191919', border: '1px solid #333', borderRadius: 8, color: '#e4e4e7', padding: '9px 12px', fontSize: 13, outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e4e4e7', padding: '24px 20px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <Link href="/dashboard/command-center" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#666', fontSize: 12, textDecoration: 'none', marginBottom: 8 }}>
              <ArrowLeft size={13} /> Command Center
            </Link>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fafafa', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={22} color="#818cf8" /> CRM — All Businesses
            </h1>
            <p style={{ color: '#666', fontSize: 13, margin: '6px 0 0' }}>Every lead and contact across the federation, in one place.</p>
          </div>
          <button onClick={load} style={{ ...sel, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <Stat label="Total leads" value={stats?.total ?? '—'} icon={<Users size={13} />} />
          <Stat label="Businesses" value={stats?.businesses ?? '—'} icon={<Building2 size={13} />} />
          <Stat label="New this week" value={stats?.newThisWeek ?? '—'} icon={<Inbox size={13} />} />
          <Stat label="Showing" value={filtered.length} icon={<Filter size={13} />} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#555' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, business…"
              style={{ ...sel, width: '100%', paddingLeft: 34 }} />
          </div>
          <select value={biz} onChange={(e) => setBiz(e.target.value)} style={{ ...sel, cursor: 'pointer' }}>
            <option value="all">All businesses</option>
            {businesses.map(([b, n]) => <option key={b} value={b}>{b} ({n})</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...sel, cursor: 'pointer' }}>
            <option value="all">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {err && <div style={{ background: '#1a1010', border: '1px solid #522', borderRadius: 10, padding: 16, color: '#f87171', fontSize: 13 }}>{err}</div>}

        {/* Table */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#151515', color: '#777', textAlign: 'left', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.6px' }}>
                  <th style={{ padding: '11px 14px' }}>Business</th>
                  <th style={{ padding: '11px 14px' }}>Name</th>
                  <th style={{ padding: '11px 14px' }}>Contact</th>
                  <th style={{ padding: '11px 14px' }}>Source</th>
                  <th style={{ padding: '11px 14px' }}>Status</th>
                  <th style={{ padding: '11px 14px' }}>Attribution</th>
                  <th style={{ padding: '11px 14px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#555' }}>Loading leads…</td></tr>
                )}
                {!loading && filtered.length === 0 && !err && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#555' }}>No leads match your filters.</td></tr>
                )}
                {!loading && filtered.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #1c1c1c' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: '#1c1c24', border: '1px solid #2a2a35', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#a5b4fc' }}>{l.business}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#f4f4f5', fontWeight: 600 }}>{l.name}</td>
                    <td style={{ padding: '10px 14px', color: '#9ca3af' }}>
                      {l.email && <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={11} />{l.email}</div>}
                      {l.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={11} />{l.phone}</div>}
                      {!l.email && !l.phone && '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{l.source}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: statusColor(l.status), fontWeight: 600 }}>{l.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#71717a', fontSize: 12 }}>
                      {l.utm_source ? `utm: ${l.utm_source}` : ''}
                      {l.utm_source && l.referrer ? ' · ' : ''}
                      {l.referrer ? `ref: ${l.referrer.replace(/^https?:\/\//, '').slice(0, 24)}` : ''}
                      {!l.utm_source && !l.referrer ? '—' : ''}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#71717a', whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import {
  ArrowLeft, ChevronDown, BarChart3, Users, Send, Eye, MousePointerClick,
  CheckCircle2, TrendingUp, Award, Target, Mail
} from 'lucide-react';
import InboundAnalytics from './InboundAnalytics';
import { OmniSiteAnalytics } from './OmniSiteAnalytics';

type LeadAgg = {
  status: string;
  count: number;
};

type AssetAgg = {
  status: string;
  count: number;
};

type DailyPoint = {
  date: string;
  leads: number;
  sent: number;
  replied: number;
};

export default function AnalyticsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    avgScore: 0,
    totalAssets: 0,
    sentAssets: 0,
    openedAssets: 0,
    repliedAssets: 0,
  });
  const [leadsByStatus, setLeadsByStatus] = useState<LeadAgg[]>([]);
  const [assetsByStatus, setAssetsByStatus] = useState<AssetAgg[]>([]);
  const [bySource, setBySource] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (!data?.length) return;
      setBusinesses(data);
      // Honor the pinned workspace from localStorage so Sammy/Jaime/Brent
      // land on their own analytics, not whoever happens to be alphabetical
      // first. Falls back to data[0] only if no pin or pin doesn't match.
      let initial: Business | null = null;
      try {
        if (typeof window !== "undefined") {
          const pinned = localStorage.getItem("omni_active_business_id");
          if (pinned && pinned !== "all") {
            initial = data.find(b => b.id === pinned) ?? null;
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
    (async () => {
      const [{ data: leads }, { data: assets }] = await Promise.all([
        supabase.from('omni_leads_generated').select('status, source, score').eq('business_id', selectedBiz.id),
        supabase.from('omni_outreach_assets').select('status, asset_type').eq('business_id', selectedBiz.id),
      ]);

      const leadsArr = leads ?? [];
      const assetsArr = assets ?? [];

      const statusCounts = leadsArr.reduce<Record<string, number>>((acc, l) => {
        acc[l.status] = (acc[l.status] ?? 0) + 1;
        return acc;
      }, {});

      const sourceCounts = leadsArr.reduce<Record<string, number>>((acc, l) => {
        acc[l.source] = (acc[l.source] ?? 0) + 1;
        return acc;
      }, {});

      const assetStatusCounts = assetsArr.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1;
        return acc;
      }, {});

      setStats({
        totalLeads: leadsArr.length,
        qualifiedLeads: leadsArr.filter(l => ['qualified', 'converted'].includes(l.status)).length,
        convertedLeads: leadsArr.filter(l => l.status === 'converted').length,
        avgScore: leadsArr.length > 0 ? Math.round(leadsArr.reduce((s, l) => s + l.score, 0) / leadsArr.length) : 0,
        totalAssets: assetsArr.length,
        sentAssets: assetsArr.filter(a => ['sent', 'opened', 'replied'].includes(a.status)).length,
        openedAssets: assetsArr.filter(a => ['opened', 'replied'].includes(a.status)).length,
        repliedAssets: assetsArr.filter(a => a.status === 'replied').length,
      });

      setLeadsByStatus(Object.entries(statusCounts).map(([status, count]) => ({ status, count })));
      setAssetsByStatus(Object.entries(assetStatusCounts).map(([status, count]) => ({ status, count })));
      setBySource(sourceCounts);
    })();
  }, [selectedBiz]);

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

  const replyRate = stats.sentAssets > 0 ? Math.round((stats.repliedAssets / stats.sentAssets) * 100) : 0;
  const openRate = stats.sentAssets > 0 ? Math.round((stats.openedAssets / stats.sentAssets) * 100) : 0;
  const conversionRate = stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0;
  const qualRate = stats.totalLeads > 0 ? Math.round((stats.qualifiedLeads / stats.totalLeads) * 100) : 0;

  const STATUS_COLORS: Record<string, string> = {
    new: '#818cf8', contacted: '#38bdf8', qualified: '#10b981',
    converted: '#4ade80', lost: '#f87171',
    draft: '#94a3b8', scheduled: '#facc15', sent: '#38bdf8',
    opened: '#a78bfa', replied: '#10b981', bounced: '#f87171',
  };

  const SOURCE_COLORS: Record<string, string> = {
    apollo: '#a78bfa', web: '#38bdf8', linkedin: '#3b82f6',
    referral: '#fb923c', manual: '#94a3b8',
  };

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={14} color="#facc15" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Analytics</span>
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

      <div className="agi-analytics-content" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
        <style jsx global>{`
          /* Mobile-first overrides for the whole Analytics page. The legacy
             InboundAnalytics + outbound grids hard-coded repeat(N,...) which
             overflowed below ~720px (KPI card text wrapped behind itself).
             These rules force the inner grids to wrap cleanly down to 360px. */
          @media (max-width: 900px) {
            .agi-analytics-content {
              padding: 16px !important;
            }
          }
          @media (max-width: 720px) {
            .agi-analytics-content [style*="grid-template-columns: repeat(6"],
            .agi-analytics-content [style*="grid-template-columns: repeat(4"] {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px !important;
            }
            .agi-analytics-content [style*="grid-template-columns: 1fr 1fr"] {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
            }
          }
          @media (max-width: 480px) {
            .agi-analytics-content [style*="grid-template-columns: repeat(6"] {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
        `}</style>

        {/* Omni AI website analytics — first-party event-stream view of
            omnileadsagi.com. Lives at the top because this is the most-
            asked-for view; the per-client InboundAnalytics + agency
            outbound metrics stay below for drill-down. */}
        <OmniSiteAnalytics />

        {/* Per-brand inbound (client website) analytics */}
        <InboundAnalytics />

        {/* Agency outbound (omni_*) metrics — kept below the per-brand section */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: '#facc15',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Agency Outbound
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.6px' }}>
            Outreach Performance — {selectedBiz?.name ?? 'Select a business'}
          </h2>
        </div>

        {/* Headline metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <BigStat icon={Users} label="Total Leads" value={stats.totalLeads} sub={`${qualRate}% qualified`} color="#818cf8" />
          <BigStat icon={Send} label="Emails Sent" value={stats.sentAssets} sub={`out of ${stats.totalAssets} assets`} color="#38bdf8" />
          <BigStat icon={Eye} label="Open Rate" value={`${openRate}%`} sub={`${stats.openedAssets} opened`} color="#a78bfa" />
          <BigStat icon={CheckCircle2} label="Reply Rate" value={`${replyRate}%`} sub={`${stats.repliedAssets} replies`} color="#10b981" />
        </div>

        {/* Funnel */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 28, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} color="#10b981" /> Conversion Funnel
          </h3>
          <FunnelBar label="Leads imported" value={stats.totalLeads} max={stats.totalLeads} color="#818cf8" />
          <FunnelBar label="Outreach generated" value={Math.min(stats.totalAssets, stats.totalLeads)} max={stats.totalLeads} color="#a78bfa" />
          <FunnelBar label="Emails sent" value={stats.sentAssets} max={stats.totalLeads} color="#38bdf8" />
          <FunnelBar label="Opened" value={stats.openedAssets} max={stats.totalLeads} color="#facc15" />
          <FunnelBar label="Replied" value={stats.repliedAssets} max={stats.totalLeads} color="#10b981" />
          <FunnelBar label="Converted" value={stats.convertedLeads} max={stats.totalLeads} color="#4ade80" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Leads by status */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Leads by Status</h3>
            {leadsByStatus.length === 0 ? <Empty /> : leadsByStatus.map(({ status, count }) => (
              <PillBar key={status} label={status} value={count} max={stats.totalLeads} color={STATUS_COLORS[status] ?? '#666'} />
            ))}
          </div>
          {/* Assets by status */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Outreach Assets by Status</h3>
            {assetsByStatus.length === 0 ? <Empty /> : assetsByStatus.map(({ status, count }) => (
              <PillBar key={status} label={status} value={count} max={stats.totalAssets} color={STATUS_COLORS[status] ?? '#666'} />
            ))}
          </div>
          {/* Source breakdown */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Lead Sources</h3>
            {Object.keys(bySource).length === 0 ? <Empty /> : Object.entries(bySource).map(([src, count]) => (
              <PillBar key={src} label={src} value={count} max={stats.totalLeads} color={SOURCE_COLORS[src] ?? '#666'} />
            ))}
          </div>
          {/* Quality */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quality Indicators</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <KV label="Average lead score" value={`${stats.avgScore} / 100`} />
              <KV label="Conversion rate" value={`${conversionRate}%`} />
              <KV label="Qualification rate" value={`${qualRate}%`} />
              <KV label="Email open rate" value={`${openRate}%`} />
              <KV label="Email reply rate" value={`${replyRate}%`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ background: `${color}18`, padding: 8, borderRadius: 8 }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-1.5px' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value} <span style={{ color: '#555' }}>· {Math.round(pct)}%</span></span>
      </div>
      <div style={{ background: '#0a0a0a', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.6s' }} />
      </div>
    </div>
  );
}

function PillBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ background: '#0a0a0a', borderRadius: 3, height: 6 }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 3 }} />
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #161616' }}>
      <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 12, color: '#444', textAlign: 'center', padding: 16 }}>No data yet</div>;
}

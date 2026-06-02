'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Mail,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  type InboundAggregateResponse,
  type InboundAggregateTenantRow,
  type InboundSlug,
} from '@/lib/inbound-types';
import { authFetch } from '@/lib/auth';

type Props = {
  /** Click a leaderboard row to switch the parent dropdown back to a
   *  single tenant. */
  onTenantClick?: (slug: InboundSlug) => void;
};

const PALETTE = {
  indigo: '#818cf8',
  sky: '#38bdf8',
  violet: '#a78bfa',
  emerald: '#4ade80',
  amber: '#facc15',
  rose: '#f87171',
  slate: '#64748b',
};

type SortKey = keyof Pick<
  InboundAggregateTenantRow,
  | 'events_30d'
  | 'page_views_30d'
  | 'leads_30d'
  | 'leads_7d'
  | 'leads_today'
  | 'bookings_30d'
  | 'newsletter_subs_30d'
>;

export default function AggregateAnalytics({ onTenantClick }: Props) {
  const [data, setData] = useState<InboundAggregateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('leads_30d');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    authFetch('/api/dashboard/aggregate-analytics', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text();
          throw new Error(`HTTP ${r.status}: ${body.slice(0, 120)}`);
        }
        return r.json();
      })
      .then((json: InboundAggregateResponse) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedTenants = useMemo(() => {
    if (!data) return [];
    const rows = [...data.by_tenant];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDesc ? bv - av : av - bv;
    });
    return rows;
  }, [data, sortKey, sortDesc]);

  const topTenant = useMemo(() => {
    if (!data) return null;
    let best: InboundAggregateTenantRow | null = null;
    for (const t of data.by_tenant) {
      if (!best || t.leads_30d > best.leads_30d) best = t;
    }
    return best;
  }, [data]);

  if (loading) {
    return (
      <div
        style={{
          padding: 32,
          color: '#999',
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        Loading portfolio rollup…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          background: '#2a0f0f',
          border: '1px solid #5a1f1f',
          color: '#fca5a5',
          padding: 16,
          borderRadius: 10,
          fontSize: 13,
          marginBottom: 20,
        }}
      >
        Couldn&apos;t load aggregate analytics: {error || 'no data'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <KpiCard
          icon={<Users size={16} />}
          color={PALETTE.indigo}
          label="Leads · 30d"
          value={data.totals.leads_30d}
          sub={`${data.totals.leads_7d} this week · ${data.totals.leads_today} today`}
        />
        <KpiCard
          icon={<Activity size={16} />}
          color={PALETTE.sky}
          label="Events · 30d"
          value={data.totals.events_30d}
          sub={`${data.totals.page_views_30d.toLocaleString()} page views`}
        />
        <KpiCard
          icon={<Mail size={16} />}
          color={PALETTE.emerald}
          label="Newsletter subs · 30d"
          value={data.totals.newsletter_subs_30d}
          sub={`Across ${data.totals.active_tenants} active tenant${data.totals.active_tenants === 1 ? '' : 's'}`}
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          color={PALETTE.violet}
          label="Top tenant · 30d"
          value={topTenant?.label ?? '—'}
          sub={
            topTenant
              ? `${topTenant.leads_30d} leads · ${topTenant.events_30d.toLocaleString()} events`
              : 'No tenant data yet'
          }
          stringValue
        />
      </div>

      {/* Daily series chart */}
      <DailySeriesChart points={data.daily_series} />

      {/* Per-tenant leaderboard */}
      <div
        style={{
          background: '#0f0f0f',
          border: '1px solid #1f1f1f',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #1f1f1f',
            fontSize: 13,
            fontWeight: 700,
            color: '#e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Per-tenant leaderboard · last 30 days</span>
          <span style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>
            click a row to drill in
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#0a0a0a',
                  color: '#888',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                <Th label="Tenant" />
                <SortableTh
                  label="Events"
                  k="events_30d"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('events_30d')}
                />
                <SortableTh
                  label="Page views"
                  k="page_views_30d"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('page_views_30d')}
                />
                <SortableTh
                  label="Leads 30d"
                  k="leads_30d"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('leads_30d')}
                />
                <SortableTh
                  label="Leads 7d"
                  k="leads_7d"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('leads_7d')}
                />
                <SortableTh
                  label="Today"
                  k="leads_today"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('leads_today')}
                />
                <SortableTh
                  label="Bookings"
                  k="bookings_30d"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('bookings_30d')}
                />
                <SortableTh
                  label="Newsl. subs"
                  k="newsletter_subs_30d"
                  current={sortKey}
                  desc={sortDesc}
                  onClick={() => toggleSort('newsletter_subs_30d')}
                />
              </tr>
            </thead>
            <tbody>
              {sortedTenants.map((t) => (
                <tr
                  key={t.slug}
                  onClick={() => onTenantClick?.(t.slug)}
                  style={{
                    cursor: onTenantClick ? 'pointer' : 'default',
                    borderTop: '1px solid #1a1a1a',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = '#141414')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <td style={{ padding: '10px 14px', color: '#e8e8e8' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                      /{t.slug}
                      {onTenantClick && (
                        <ArrowUpRight
                          size={9}
                          style={{ marginLeft: 4, verticalAlign: 'middle' }}
                        />
                      )}
                    </div>
                  </td>
                  <Td value={t.events_30d} />
                  <Td value={t.page_views_30d} />
                  <Td value={t.leads_30d} highlight={sortKey === 'leads_30d'} />
                  <Td value={t.leads_7d} highlight={sortKey === 'leads_7d'} />
                  <Td
                    value={t.leads_today}
                    highlight={sortKey === 'leads_today'}
                  />
                  <Td value={t.bookings_30d} />
                  <Td value={t.newsletter_subs_30d} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event-type breakdown */}
      <div
        style={{
          background: '#0f0f0f',
          border: '1px solid #1f1f1f',
          borderRadius: 12,
          padding: 18,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#e8e8e8',
            marginBottom: 14,
          }}
        >
          Event type breakdown · portfolio · 30d
        </div>
        <EventTypeBars rows={data.by_event_type} />
      </div>

      <div style={{ fontSize: 10, color: '#555', textAlign: 'right' }}>
        Fetched {new Date(data.fetched_at).toLocaleString()}
      </div>
    </div>
  );

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(k);
      setSortDesc(true);
    }
  }
}

function KpiCard({
  icon,
  color,
  label,
  value,
  sub,
  stringValue,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number | string;
  sub: string;
  stringValue?: boolean;
}) {
  return (
    <div
      style={{
        background: '#0f0f0f',
        border: '1px solid #1f1f1f',
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color,
          marginBottom: 10,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: stringValue ? 18 : 26,
          fontWeight: 800,
          color: '#fafafa',
          letterSpacing: '-0.4px',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Th({ label }: { label: string }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 14px',
        fontWeight: 700,
      }}
    >
      {label}
    </th>
  );
}

function SortableTh({
  label,
  k,
  current,
  desc,
  onClick,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  desc: boolean;
  onClick: () => void;
}) {
  const active = k === current;
  return (
    <th
      onClick={onClick}
      style={{
        textAlign: 'right',
        padding: '8px 14px',
        fontWeight: 700,
        cursor: 'pointer',
        color: active ? '#a78bfa' : '#888',
        userSelect: 'none',
      }}
    >
      {label} {active ? (desc ? '↓' : '↑') : ''}
    </th>
  );
}

function Td({
  value,
  highlight,
}: {
  value: number;
  highlight?: boolean;
}) {
  return (
    <td
      style={{
        padding: '10px 14px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        color: highlight ? '#a78bfa' : value === 0 ? '#555' : '#ccc',
        fontWeight: highlight ? 700 : 500,
      }}
    >
      {value.toLocaleString()}
    </td>
  );
}

function EventTypeBars({
  rows,
}: {
  rows: { event_type: string; count: number }[];
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#666', padding: 20 }}>
        No events recorded in the last 30 days. Once trackers fire,
        type-level breakdown shows here.
      </div>
    );
  }
  const COLORS = [
    PALETTE.indigo,
    PALETTE.sky,
    PALETTE.violet,
    PALETTE.emerald,
    PALETTE.amber,
    PALETTE.rose,
    PALETTE.slate,
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.slice(0, 12).map((r, i) => (
        <div
          key={r.event_type}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div
            style={{
              width: 140,
              fontSize: 12,
              color: '#bbb',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            {r.event_type}
          </div>
          <div
            style={{
              flex: 1,
              height: 18,
              background: '#191919',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(r.count / max) * 100}%`,
                height: '100%',
                background: COLORS[i % COLORS.length],
                borderRadius: 4,
                transition: 'width .25s ease',
              }}
            />
          </div>
          <div
            style={{
              width: 80,
              textAlign: 'right',
              fontSize: 12,
              color: '#ddd',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {r.count.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function DailySeriesChart({
  points,
}: {
  points: { date: string; events: number; leads: number; bookings: number }[];
}) {
  const W = 720;
  const H = 180;
  const PAD_X = 28;
  const PAD_Y = 18;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const xStep = innerW / Math.max(1, points.length - 1);

  const maxEvents = Math.max(1, ...points.map((p) => p.events));
  const maxLeads = Math.max(1, ...points.map((p) => p.leads));

  const pathFor = (key: 'events' | 'leads') => {
    const max = key === 'events' ? maxEvents : maxLeads;
    return points
      .map((p, i) => {
        const y = PAD_Y + innerH - (p[key] / max) * innerH;
        const x = PAD_X + i * xStep;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const lastDate = points[points.length - 1]?.date ?? '';
  const firstDate = points[0]?.date ?? '';

  return (
    <div
      style={{
        background: '#0f0f0f',
        border: '1px solid #1f1f1f',
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#e8e8e8',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Daily activity · portfolio · 30d</span>
        <span style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 500 }}>
          <span style={{ color: PALETTE.sky }}>● Events</span>
          <span style={{ color: PALETTE.indigo }}>● Leads</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <path
          d={pathFor('events')}
          stroke={PALETTE.sky}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathFor('leads')}
          stroke={PALETTE.indigo}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#666',
          marginTop: 4,
        }}
      >
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  );
}

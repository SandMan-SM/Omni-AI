'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  CreditCard,
  Eye,
  Globe,
  MousePointerClick,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  INBOUND_SLUG_LABELS,
  INBOUND_SLUGS,
  isInboundSlug,
  type InboundAnalyticsResponse,
  type InboundSlug,
} from '@/lib/inbound-types';

type Props = {
  /** Default slug if URL search param is absent. */
  defaultSlug?: InboundSlug;
};

const PALETTE = {
  indigo: '#818cf8',
  sky: '#38bdf8',
  violet: '#a78bfa',
  green: '#10b981',
  emerald: '#4ade80',
  amber: '#facc15',
  rose: '#f87171',
  slate: '#64748b',
};

export default function InboundAnalytics({ defaultSlug = 'ltb' }: Props) {
  const [slug, setSlug] = useState<InboundSlug>(defaultSlug);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<InboundAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // When the parent passes a new defaultSlug (e.g. SiteAnalyticsRouter
  // re-resolves after a workspace switch from LTB → Prime IV), sync the
  // internal slug state so the panel re-fetches against the new brand.
  // Without this, useState only initialises once and the panel stays on
  // the previous client's data.
  useEffect(() => {
    setSlug(defaultSlug);
  }, [defaultSlug]);

  // Hydrate from ?brand=... and keep URL in sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('brand');
    if (fromUrl && isInboundSlug(fromUrl)) {
      setSlug(fromUrl);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('brand') !== slug) {
      params.set('brand', slug);
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', next);
    }
  }, [slug]);

  // Fetch payload whenever slug changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('omni_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/dashboard/inbound/${slug}`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          throw new Error(`${r.status} ${txt || r.statusText}`);
        }
        return (await r.json()) as InboundAnalyticsResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load analytics');
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const brandLabel = data?.brand_label ?? INBOUND_SLUG_LABELS[slug];
  const hasOrders = data?.has_orders ?? false;

  const funnelMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      data.funnel.page_view_count,
      data.funnel.cta_click_count,
      data.funnel.form_submit_count,
      data.funnel.lead_count,
      data.funnel.booking_count,
      data.funnel.order_count ?? 0,
      1,
    );
  }, [data]);

  const tsMax = useMemo(() => {
    if (!data) return 1;
    let m = 1;
    for (const p of data.time_series) {
      if (p.page_views > m) m = p.page_views;
      if (p.leads > m) m = p.leads;
    }
    return m;
  }, [data]);

  const totalDevices = useMemo(() => {
    if (!data) return 0;
    return data.device_split.reduce((s, d) => s + d.count, 0);
  }, [data]);

  return (
    <section
      style={{
        background: '#0d0d0d',
        border: '1px solid #1e1e1e',
        borderRadius: 14,
        padding: 28,
        marginBottom: 28,
      }}
    >
      {/* Header + brand selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
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
            Client Website Performance
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.6px',
            }}
          >
            {brandLabel} Website Performance
          </h2>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#161616',
              border: '1px solid #262626',
              borderRadius: 10,
              padding: '8px 14px',
              cursor: 'pointer',
              color: '#e8e8e8',
              minWidth: 220,
            }}
          >
            <span style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Brand
            </span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{brandLabel}</span>
            <ChevronDown size={13} color="#555" style={{ marginLeft: 'auto' }} />
          </button>
          {open && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                background: '#111',
                border: '1px solid #222',
                borderRadius: 10,
                minWidth: 240,
                zIndex: 20,
                overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
              }}
            >
              {INBOUND_SLUGS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSlug(s);
                    setOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: s === slug ? '#191919' : 'transparent',
                    border: 'none',
                    color: '#e8e8e8',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{INBOUND_SLUG_LABELS[s]}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>/{s}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
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
          Couldn&apos;t load analytics for {brandLabel}: {error}
        </div>
      )}

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <BigStat
          icon={Users}
          label="Leads Today"
          value={loading ? '—' : data?.kpis.total_leads_today ?? 0}
          sub={loading ? ' ' : `${data?.kpis.total_leads_7d ?? 0} this week`}
          color={PALETTE.indigo}
        />
        <BigStat
          icon={TrendingUp}
          label="Leads 30d"
          value={loading ? '—' : data?.kpis.total_leads_30d ?? 0}
          sub="Last 30 days"
          color={PALETTE.violet}
        />
        <BigStat
          icon={Activity}
          label="Bookings 30d"
          value={loading ? '—' : data?.kpis.total_bookings_30d ?? 0}
          sub="Last 30 days"
          color={PALETTE.sky}
        />
        {hasOrders ? (
          <BigStat
            icon={CreditCard}
            label="Orders 30d"
            value={loading ? '—' : data?.kpis.total_orders_30d ?? 0}
            sub={
              loading
                ? ' '
                : formatCurrency(data?.kpis.total_revenue_30d ?? 0) + ' revenue'
            }
            color={PALETTE.emerald}
          />
        ) : (
          <BigStat
            icon={CreditCard}
            label="Orders"
            value="—"
            sub="Not tracked for this brand"
            color={PALETTE.slate}
            muted
          />
        )}
        <BigStat
          icon={Eye}
          label="Visitors 30d"
          value={loading ? '—' : data?.kpis.unique_visitors_30d ?? 0}
          sub="Unique sessions"
          color={PALETTE.amber}
        />
        <BigStat
          icon={Globe}
          label="Avg Session"
          value={loading ? '—' : formatDuration(data?.kpis.avg_session_duration ?? 0)}
          sub="Mins per visitor"
          color={PALETTE.green}
        />
      </div>

      {/* Funnel + time-series row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <Card title="Conversion Funnel (30d)" icon={<TrendingUp size={14} color={PALETTE.green} />}>
          {!data ? (
            <Empty />
          ) : (
            <>
              <FunnelBar label="Page views" value={data.funnel.page_view_count} max={funnelMax} color={PALETTE.indigo} />
              <FunnelBar label="CTA clicks" value={data.funnel.cta_click_count} max={funnelMax} color={PALETTE.violet} />
              <FunnelBar label="Form submits" value={data.funnel.form_submit_count} max={funnelMax} color={PALETTE.sky} />
              <FunnelBar label="Leads" value={data.funnel.lead_count} max={funnelMax} color={PALETTE.amber} />
              <FunnelBar label="Bookings" value={data.funnel.booking_count} max={funnelMax} color={PALETTE.green} />
              {hasOrders && (
                <FunnelBar
                  label="Orders"
                  value={data.funnel.order_count ?? 0}
                  max={funnelMax}
                  color={PALETTE.emerald}
                />
              )}
            </>
          )}
        </Card>

        <Card title="Page Views vs. Leads (30d)" icon={<Activity size={14} color={PALETTE.sky} />}>
          {!data ? (
            <Empty />
          ) : (
            <TimeSeries data={data.time_series} max={tsMax} />
          )}
        </Card>
      </div>

      {/* Top pages + Top CTAs row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <Card title="Top Pages" icon={<Eye size={14} color={PALETTE.indigo} />}>
          {!data || data.top_pages.length === 0 ? (
            <Empty />
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Path</Th>
                  <Th align="right">Views</Th>
                  <Th align="right">Conv.</Th>
                  <Th>Activity</Th>
                </tr>
              </thead>
              <tbody>
                {data.top_pages.map((p) => {
                  const max = data.top_pages[0]?.page_views || 1;
                  const pct = (p.page_views / max) * 100;
                  return (
                    <tr key={p.path} style={{ borderTop: '1px solid #161616' }}>
                      <Td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={p.path}>{p.path}</span>
                      </Td>
                      <Td align="right">{p.page_views}</Td>
                      <Td align="right" style={{ color: PALETTE.green }}>
                        {Math.round(p.conversion_rate * 100)}%
                      </Td>
                      <Td>
                        <div style={{ background: '#0a0a0a', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: PALETTE.indigo, height: '100%' }} />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Top CTAs" icon={<MousePointerClick size={14} color={PALETTE.violet} />}>
          {!data || data.top_ctas.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.top_ctas.map((c) => {
                const max = data.top_ctas[0]?.count || 1;
                const pct = (c.count / max) * 100;
                return (
                  <div key={c.cta}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#cbd5e1',
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={c.cta}
                      >
                        {c.cta}
                      </span>
                      <span style={{ fontSize: 12, color: PALETTE.violet, fontWeight: 700 }}>{c.count}</span>
                    </div>
                    <div style={{ background: '#0a0a0a', height: 6, borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, background: PALETTE.violet, height: '100%', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Sources, scroll depth, device, recent leads */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
        <Card title="Traffic Sources" icon={<Globe size={14} color={PALETTE.sky} />}>
          {!data || data.traffic_sources.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.traffic_sources.map((t) => {
                const total = data.traffic_sources.reduce((s, x) => s + x.count, 0) || 1;
                const pct = (t.count / total) * 100;
                return (
                  <div key={t.source}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>{t.source}</span>
                      <span style={{ fontSize: 12, color: PALETTE.sky, fontWeight: 700 }}>
                        {t.count} <span style={{ color: '#555' }}>· {pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div style={{ background: '#0a0a0a', height: 6, borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, background: PALETTE.sky, height: '100%', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Scroll Depth" icon={<TrendingUp size={14} color={PALETTE.amber} />}>
          {!data ? (
            <Empty />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.scroll_depth_distribution.map((b) => {
                const max = Math.max(
                  ...data.scroll_depth_distribution.map((x) => x.count),
                  1,
                );
                const pct = (b.count / max) * 100;
                return (
                  <div key={b.bucket}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#cbd5e1' }}>{b.bucket}%</span>
                      <span style={{ fontSize: 12, color: PALETTE.amber, fontWeight: 700 }}>{b.count}</span>
                    </div>
                    <div style={{ background: '#0a0a0a', height: 6, borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, background: PALETTE.amber, height: '100%', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Device Split" icon={<Smartphone size={14} color={PALETTE.green} />}>
          {!data || totalDevices === 0 ? (
            <Empty />
          ) : (
            <Donut
              segments={data.device_split.map((d, i) => ({
                label: d.device,
                value: d.count,
                color: deviceColor(d.device, i),
              }))}
              total={totalDevices}
            />
          )}
        </Card>
      </div>

      {/* Recent leads */}
      <Card title="Recent Leads" icon={<Users size={14} color={PALETTE.indigo} />}>
        {!data || data.recent_leads.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th>Page</Th>
                  <Th align="right">When</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent_leads.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid #161616' }}>
                    <Td>{l.full_name || '—'}</Td>
                    <Td>{l.email || '—'}</Td>
                    <Td>{l.utm_source || l.source || 'direct'}</Td>
                    <Td
                      style={{
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#94a3b8',
                      }}
                    >
                      {l.page_path || '—'}
                    </Td>
                    <Td align="right" style={{ color: '#94a3b8' }}>
                      {timeAgo(l.created_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasOrders && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #1e1e1e' }}>
            <a
              href="https://billing.stripe.com/p/login"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <CreditCard size={14} /> Open Stripe Customer Portal
            </a>
          </div>
        )}
      </Card>
    </section>
  );
}

/* ---------- helpers ---------- */

function deviceColor(device: string, i: number): string {
  const map: Record<string, string> = {
    mobile: PALETTE.violet,
    desktop: PALETTE.sky,
    tablet: PALETTE.amber,
    unknown: PALETTE.slate,
  };
  if (map[device]) return map[device];
  const fallback = [PALETTE.indigo, PALETTE.green, PALETTE.rose, PALETTE.emerald];
  return fallback[i % fallback.length];
}

function formatCurrency(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

/* ---------- presentational primitives ---------- */

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #1e1e1e',
        borderRadius: 12,
        padding: 22,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#e8e8e8',
        }}
      >
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function BigStat({
  icon: Icon,
  label,
  value,
  sub,
  color,
  muted,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #1e1e1e',
        borderRadius: 12,
        padding: 18,
        opacity: muted ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ background: `${color}22`, padding: 7, borderRadius: 7 }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8e8', letterSpacing: '-0.8px' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>
          {value}
          <span style={{ color: '#555', marginLeft: 6 }}>· {Math.round(pct)}%</span>
        </span>
      </div>
      <div style={{ background: '#0a0a0a', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function TimeSeries({
  data,
  max,
}: {
  data: { date: string; page_views: number; leads: number }[];
  max: number;
}) {
  // Inline sparkline-style SVG with two overlaid series.
  const W = 460;
  const H = 160;
  const PAD_X = 8;
  const PAD_Y = 8;
  const xStep = data.length > 1 ? (W - PAD_X * 2) / (data.length - 1) : 0;
  const y = (v: number) => H - PAD_Y - (max > 0 ? (v / max) * (H - PAD_Y * 2) : 0);

  const path = (key: 'page_views' | 'leads') =>
    data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${PAD_X + i * xStep} ${y(p[key])}`)
      .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
        <defs>
          <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.indigo} stopOpacity="0.3" />
            <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path('page_views')} L ${PAD_X + (data.length - 1) * xStep} ${H - PAD_Y} L ${PAD_X} ${H - PAD_Y} Z`} fill="url(#pvFill)" />
        <path d={path('page_views')} stroke={PALETTE.indigo} strokeWidth={1.5} fill="none" />
        <path d={path('leads')} stroke={PALETTE.green} strokeWidth={1.5} fill="none" />
      </svg>
      <div style={{ display: 'flex', gap: 18, fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
        <Legend color={PALETTE.indigo} label="Page views" />
        <Legend color={PALETTE.green} label="Leads" />
        <span style={{ marginLeft: 'auto', color: '#555' }}>
          {data[0]?.date} → {data[data.length - 1]?.date}
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: 2, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function Donut({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const size = 140;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a1a1a" strokeWidth={16} />
        {segments.map((s) => {
          const frac = total > 0 ? s.value / total : 0;
          const dash = frac * circumference;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }} />
            <span style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{s.label}</span>
            <span style={{ color: '#666', marginLeft: 'auto' }}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      style={{
        textAlign: align,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.7px',
        color: '#666',
        padding: '8px 10px 8px 0',
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  style,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: '8px 10px 8px 0',
        color: '#e8e8e8',
        fontSize: 12,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function Empty() {
  return (
    <div style={{ fontSize: 12, color: '#444', textAlign: 'center', padding: 24 }}>
      No data yet
    </div>
  );
}

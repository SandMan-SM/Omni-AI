"use client";

/**
 * Omni site analytics — first-party event-stream view of omnileadsagi.com.
 *
 * Renders KPI cards + a 14-day visitors/page-views chart + Top Pages,
 * Top Click Targets, Referrers, and Device split. All numbers come from
 * GET /api/admin/analytics, which aggregates the last 30 days of rows
 * from the `events` table written by <SiteTracker /> in app/layout.tsx.
 *
 * Layout uses an auto-fit `repeat(auto-fit, minmax(160px, 1fr))` grid so
 * the card strip wraps cleanly from 6-up on desktop down to 2-up on a
 * 360px phone — matching the rest of the agentic dashboard's mobile
 * behavior (the legacy InboundAnalytics had `repeat(6, …)` hard-coded
 * which overflowed on phones; that one's also fixed in this commit).
 */
import { useEffect, useState } from "react";
import {
  Users, Eye, Activity, MousePointerClick, Send, BarChart3,
  Smartphone, Monitor, Globe, ArrowUpRight, RefreshCw, Loader2,
} from "lucide-react";

type Range = '24h' | '7d' | '30d' | 'all';

interface AnalyticsResponse {
  range: Range;
  rangeLabel: string;
  bucketUnit: 'hour' | 'day' | 'week';
  host: string;
  traffic: {
    pageViews: number;
    sessions: number;
    visitors: number;
    clicks: number;
    formSubmits: number;
  };
  daily: { day: string; page_views: number; sessions: number; clicks: number }[];
  topPages: { page_url: string; views: number; visitors: number }[];
  topClicks: { label: string; clicks: number; pages: string[]; href: string | null }[];
  topReferrers: { referrer: string; sessions: number }[];
  devices: { mobile: number; desktop: number };
}

const RANGES: { id: Range; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '30d', label: '30 days' },
  { id: '7d',  label: '7 days' },
  { id: '24h', label: '24h' },
];

const PALETTE = {
  indigo: "#818cf8",
  violet: "#a78bfa",
  sky: "#38bdf8",
  emerald: "#10b981",
  amber: "#facc15",
  rose: "#fb7185",
  slate: "#64748b",
};

type OmniSiteAnalyticsProps = {
  /**
   * Optional inbound slug (federation tracker partition). When set to
   * a valid INBOUND_SLUGS member, the API reads from
   * `inbound_<slug>_events` instead of the central `events` table.
   * Special value `"all"` triggers the admin-only federation rollup
   * (every tenant + omnileadsagi.com aggregated into one view).
   * Passing only `host` for non-omni tenants used to read 0 rows
   * out of `events` and silently fall back to omnileadsagi.com data.
   */
  slug?: string;
  /**
   * Optional host (domain) to scope analytics to. e.g. "sitanimafi.live".
   * Used when slug isn't a valid INBOUND_SLUGS entry. When omitted,
   * the API falls back to omnileadsagi.com so the legacy admin view
   * keeps its prior behavior.
   */
  host?: string;
  /**
   * GA4 measurement ID (e.g. "G-6JZP5C4NMQ") for the active workspace.
   * When present, the panel header renders a green "GA4: G-…" badge
   * so $Mafi can see at a glance which sites are GA4-instrumented.
   * When null/undefined the badge says "GA4 not configured".
   */
  ga4MeasurementId?: string | null;
  /**
   * Pretty name to show above the panel — defaults to the resolved
   * host. Used by the "All Businesses" rollup to print "All Businesses
   * · federation rollup" instead of the literal slug "federation".
   */
  displayName?: string | null;
  /**
   * True when this panel is rendering the admin-only federation
   * rollup. Disables the "Visit site" button (no single domain to
   * visit) and swaps the header copy to a rollup-specific subtitle.
   */
  isAllRollup?: boolean;
};

export function OmniSiteAnalytics({
  slug,
  host,
  ga4MeasurementId,
  displayName,
  isAllRollup,
}: OmniSiteAnalyticsProps = {}) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadAt, setReloadAt] = useState(0);
  // Default to "all time" — owner asked for the broadest view by default,
  // with quick toggles to drill down to 30d / 7d / 24h.
  const [range, setRange] = useState<Range>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
    const slugQp = slug ? `&slug=${encodeURIComponent(slug)}` : "";
    const hostQp = host ? `&host=${encodeURIComponent(host)}` : "";
    fetch(`/api/admin/analytics?range=${range}${slugQp}${hostQp}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          // Surface 401/403 with a workspace-mapping hint so operators
          // can self-diagnose. Other errors fall through to the
          // server's message or a status-only fallback.
          if (r.status === 401 || r.status === 403) {
            const msg = body?.error || `HTTP ${r.status}`;
            throw new Error(
              `${msg} · Analytics scoped to this workspace require admin or a brand-member mapping. Contact $Mafi if you should have access.`
            );
          }
          throw new Error(body?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadAt, range, slug, host]);

  const t = data?.traffic;
  const totalDevice = (data?.devices.mobile ?? 0) + (data?.devices.desktop ?? 0);
  const mobilePct = totalDevice > 0 ? Math.round(((data?.devices.mobile ?? 0) / totalDevice) * 100) : 0;
  const desktopPct = totalDevice > 0 ? Math.round(((data?.devices.desktop ?? 0) / totalDevice) * 100) : 0;
  const rangeLabel = data?.rangeLabel ?? RANGES.find(r => r.id === range)?.label ?? "Last 30 days";
  const subLabel = range === "all" ? "All-time totals" : `Last ${range === "24h" ? "24 hours" : range === "7d" ? "7 days" : "30 days"}`;

  return (
    <div className="omni-site-analytics" style={{ marginBottom: 32 }}>
      <style jsx>{`
        /* Mobile-friendly grid breakpoints. The KPI strip auto-fits down
           to 2 columns at 360px; the chart + tables stack from 2-up to
           1-up below 720px. */
        .osa-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .osa-split-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 720px) {
          .osa-split-2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .osa-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          /* Range pills shrink + wrap on tiny phones so the toggle row
             doesn't fight the Refresh + Visit-site buttons for space. */
          .osa-range :global(button) {
            padding: 5px 10px !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#10b981", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
            {isAllRollup
              ? "All businesses · federation rollup"
              : (displayName ?? data?.host ?? host ?? "omnileadsagi.com")}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.6px", margin: 0 }}>
            Site Analytics
          </h2>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>
              {isAllRollup
                ? `Aggregated across every workspace · ${rangeLabel.toLowerCase()}`
                : `First-party tracking · ${rangeLabel.toLowerCase()}`}
            </span>
            {/* GA4 status badge — only on per-tenant view. Green pill
                when configured, dim slate pill when not. Single source
                of truth on "is this site instrumented yet?" */}
            {!isAllRollup && (
              ga4MeasurementId ? (
                <span
                  title={`Google Analytics 4 — ${ga4MeasurementId}`}
                  style={{
                    background: "#0d2b1a",
                    border: "1px solid #14532d",
                    color: "#34d399",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    textTransform: "none",
                  }}
                >
                  GA4 · {ga4MeasurementId}
                </span>
              ) : (
                <span
                  title="Google Analytics 4 not yet configured for this workspace"
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#666",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                  }}
                >
                  GA4 not configured
                </span>
              )
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Range toggle pills */}
          <div className="osa-range" style={{ display: "inline-flex", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 999, padding: 3 }}>
            {RANGES.map(r => {
              const active = r.id === range;
              return (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  disabled={loading && active}
                  style={{
                    background: active ? "#1f2937" : "transparent",
                    border: "none",
                    color: active ? "#10b981" : "#94a3b8",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    cursor: loading ? "wait" : "pointer",
                    transition: "background 0.12s, color 0.12s",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setReloadAt(Date.now())}
            disabled={loading}
            style={{
              background: "#161616", border: "1px solid #262626",
              color: loading ? "#444" : "#cbd5e1",
              padding: "7px 12px", borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
          {/* Visit-site link is suppressed in rollup mode — there is no
              single domain to point at when "All Businesses" is active. */}
          {!isAllRollup && (
            <a
              href={`https://${host ?? data?.host ?? "omnileadsagi.com"}`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: "#161616", border: "1px solid #262626",
                color: "#cbd5e1", padding: "7px 12px", borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 6,
                textDecoration: "none",
              }}
            >
              Visit site <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "#2a0f0f", border: "1px solid #5a1f1f", color: "#fca5a5", padding: 16, borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
          Couldn&apos;t load site analytics: {error}
        </div>
      )}

      {/* KPI strip — every card shows a number for the active range. */}
      <div className="osa-kpi-grid" style={{ marginBottom: 20 }}>
        <Stat icon={Eye}                value={loading ? "—" : t?.pageViews ?? 0}    label="Page views"   sub={subLabel} color={PALETTE.indigo} />
        <Stat icon={Users}              value={loading ? "—" : t?.visitors ?? 0}     label="Visitors"     sub={subLabel} color={PALETTE.sky} />
        <Stat icon={Globe}              value={loading ? "—" : t?.sessions ?? 0}     label="Sessions"     sub={subLabel} color={PALETTE.emerald} />
        <Stat icon={MousePointerClick}  value={loading ? "—" : t?.clicks ?? 0}       label="Clicks"       sub={subLabel} color={PALETTE.amber} />
        <Stat icon={Send}               value={loading ? "—" : t?.formSubmits ?? 0}  label="Form submits" sub={subLabel} color={PALETTE.rose} />
        <Stat icon={Activity}           value={loading ? "—" : (t?.pageViews && t?.sessions ? (t.pageViews / Math.max(1, t.sessions)).toFixed(1) : "0")} label="Pages / session" sub={subLabel} color={PALETTE.violet} />
      </div>

      {/* Adaptive chart — bucket size shifts with the active range. */}
      <Card title={`Traffic — ${rangeLabel.toLowerCase()}`} icon={BarChart3}>
        {loading ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#444" }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : data?.daily?.length ? (
          <DailyChart rows={data.daily} bucketUnit={data.bucketUnit} />
        ) : (
          <Empty />
        )}
      </Card>

      {/* Two-column section: Top Pages + Top Clicks */}
      <div className="osa-split-2" style={{ marginTop: 16 }}>
        <Card title={`Top pages — ${rangeLabel.toLowerCase()}`} icon={Eye}>
          {loading ? <Skel /> : data?.topPages?.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.topPages.map((p) => {
                const max = data.topPages[0]?.views || 1;
                const pct = (p.views / max) * 100;
                return (
                  <li key={p.page_url} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1, marginRight: 8 }}>
                        {p.page_url}
                      </span>
                      <span style={{ fontSize: 12, color: PALETTE.indigo, fontWeight: 700, flexShrink: 0 }}>
                        {p.views} <span style={{ color: "#555", fontWeight: 400 }}>· {p.visitors} unique</span>
                      </span>
                    </div>
                    <div style={{ background: "#0a0a0a", borderRadius: 3, height: 5 }}>
                      <div style={{ width: `${pct}%`, background: PALETTE.indigo, height: "100%", borderRadius: 3 }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty />}
        </Card>

        <Card title={`Top click targets — ${rangeLabel.toLowerCase()}`} icon={MousePointerClick}>
          {loading ? <Skel /> : data?.topClicks?.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.topClicks.map((c, i) => {
                const max = data.topClicks[0]?.clicks || 1;
                const pct = (c.clicks / max) * 100;
                return (
                  <li key={`${c.label}-${i}`} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1, marginRight: 8 }}>
                        {c.label}
                      </span>
                      <span style={{ fontSize: 12, color: PALETTE.amber, fontWeight: 700, flexShrink: 0 }}>{c.clicks}</span>
                    </div>
                    <div style={{ background: "#0a0a0a", borderRadius: 3, height: 5 }}>
                      <div style={{ width: `${pct}%`, background: PALETTE.amber, height: "100%", borderRadius: 3 }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty />}
        </Card>
      </div>

      {/* Two-column section: Referrers + Devices */}
      <div className="osa-split-2" style={{ marginTop: 16 }}>
        <Card title={`Referrers — ${rangeLabel.toLowerCase()}`} icon={Globe}>
          {loading ? <Skel /> : data?.topReferrers?.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.topReferrers.map((r) => {
                const max = data.topReferrers[0]?.sessions || 1;
                const pct = (r.sessions / max) * 100;
                return (
                  <li key={r.referrer} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#cbd5e1", textTransform: r.referrer === "direct" || r.referrer === "internal" ? "capitalize" : "none" }}>
                        {r.referrer}
                      </span>
                      <span style={{ fontSize: 12, color: PALETTE.sky, fontWeight: 700 }}>{r.sessions}</span>
                    </div>
                    <div style={{ background: "#0a0a0a", borderRadius: 3, height: 5 }}>
                      <div style={{ width: `${pct}%`, background: PALETTE.sky, height: "100%", borderRadius: 3 }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty />}
        </Card>

        <Card title={`Devices — ${rangeLabel.toLowerCase()}`} icon={Smartphone}>
          {loading ? <Skel /> : totalDevice > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
              <DeviceRow icon={Monitor} label="Desktop" value={data?.devices.desktop ?? 0} pct={desktopPct} color={PALETTE.indigo} />
              <DeviceRow icon={Smartphone} label="Mobile" value={data?.devices.mobile ?? 0} pct={mobilePct} color={PALETTE.violet} />
            </div>
          ) : <Empty />}
        </Card>
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────

function Stat({
  icon: Icon, value, label, sub, color,
}: { icon: React.ElementType; value: string | number; label: string; sub?: string; color: string }) {
  return (
    <div style={{
      background: "#111", border: "1px solid #1e1e1e", borderRadius: 12,
      padding: 14, minWidth: 0,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ background: `${color}18`, padding: 6, borderRadius: 6, lineHeight: 0 }}>
          <Icon size={13} color={color} />
        </div>
        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#e8e8e8", letterSpacing: "-1px", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#555" }}>{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 18 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
        <Icon size={13} color="#666" /> {title}
      </h3>
      {children}
    </div>
  );
}

function DeviceRow({ icon: Icon, label, value, pct, color }: { icon: React.ElementType; label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
          <Icon size={13} color={color} /> {label}
        </span>
        <span style={{ fontSize: 13, color, fontWeight: 700 }}>{value} <span style={{ color: "#555", fontWeight: 400 }}>· {pct}%</span></span>
      </div>
      <div style={{ background: "#0a0a0a", borderRadius: 4, height: 7 }}>
        <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: 24 }}>No data yet</div>;
}

function Skel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 22, background: "#161616", borderRadius: 6, opacity: 0.6 }} />
      ))}
    </div>
  );
}

function DailyChart({ rows, bucketUnit }: { rows: { day: string; page_views: number; sessions: number; clicks: number }[]; bucketUnit: "hour" | "day" | "week" }) {
  const W = 760;
  const H = 200;
  const PAD_X = 28;
  const PAD_Y = 16;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.page_views, r.sessions)));
  const xStep = (W - PAD_X * 2) / Math.max(1, rows.length - 1);

  const path = (key: "page_views" | "sessions") =>
    rows
      .map((r, i) => {
        const x = PAD_X + i * xStep;
        const y = H - PAD_Y - (r[key] / max) * (H - PAD_Y * 2);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", margin: "0 -4px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", minWidth: 320, maxWidth: "100%" }}>
        <defs>
          <linearGradient id="osa-pv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.indigo} stopOpacity="0.5" />
            <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={H - PAD_Y - p * (H - PAD_Y * 2)}
            y2={H - PAD_Y - p * (H - PAD_Y * 2)}
            stroke="#1e1e1e"
            strokeDasharray={i === 0 ? undefined : "2 4"}
          />
        ))}

        {/* page_views area + line */}
        <path
          d={`${path("page_views")} L ${PAD_X + (rows.length - 1) * xStep} ${H - PAD_Y} L ${PAD_X} ${H - PAD_Y} Z`}
          fill="url(#osa-pv-fill)"
        />
        <path d={path("page_views")} stroke={PALETTE.indigo} strokeWidth={1.6} fill="none" />

        {/* sessions line */}
        <path d={path("sessions")} stroke={PALETTE.emerald} strokeWidth={1.4} fill="none" strokeDasharray="3 3" />

        {/* x-axis labels — first, middle, last. Format depends on bucket
            unit: hourly shows HH:00, daily shows MM-DD, weekly shows MM-DD
            (the start of the week). */}
        {[0, Math.floor(rows.length / 2), rows.length - 1].map((i) => {
          const raw = rows[i]?.day ?? "";
          const label = bucketUnit === "hour"
            ? `${raw.slice(11, 13)}:00`
            : raw.slice(5); // MM-DD
          return (
            <text
              key={i}
              x={PAD_X + i * xStep}
              y={H - 2}
              textAnchor="middle"
              fontSize="9"
              fill="#555"
              fontFamily="ui-monospace, monospace"
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#666", marginTop: 8, paddingLeft: PAD_X }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 2, background: PALETTE.indigo, display: "inline-block" }} /> Page views
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 2, background: PALETTE.emerald, display: "inline-block", borderTop: `2px dashed ${PALETTE.emerald}` }} /> Sessions
        </span>
      </div>
    </div>
  );
}

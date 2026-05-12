'use client';

// /dashboard/marketing — operator console for the Federation Marketing System.
//
// Read-only data loads from /api/marketing/list. Mutations (enqueue,
// run, approve, reject) go through /api/marketing/campaign. Auth is
// handled by authFetch which carries the admin session header.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth';

type Stats = {
  scheduled: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  suppressed: number;
} | null;

type Campaign = {
  id: string;
  business_slug: string;
  kind: 'product' | 'brand_deal';
  subject_template: string;
  sender_display: string;
  sender_email: string;
  reply_to_email: string;
  audience_kind: 'owner_network' | 'brand_deal_prospects';
  status: 'draft' | 'active' | 'paused' | 'completed';
  daily_throttle: number;
  hourly_throttle: number;
  landing_id: string | null;
  created_at: string;
  stats: Stats;
};

type Prospect = {
  id: string;
  target_business_slug: string;
  prospect_email: string;
  first_name: string | null;
  company: string | null;
  role: string | null;
  source: 'apollo' | 'manual' | 'csv';
  created_at: string;
};

type Owner = {
  id: string;
  full_name: string;
  first_name: string;
  email: string;
  role: string;
  business_slugs: string[];
  unsubscribed_at: string | null;
};

type Landing = {
  id: string;
  business_slug: string;
  kind: 'product' | 'brand_deal';
  slug: string;
  headline: string;
  status: 'draft' | 'published' | 'archived';
};

type DomainRep = {
  domain: string;
  sent: number;
  bounce_rate: number;
  complaint_rate: number;
  unsubscribe_rate: number;
};

type ListResponse = {
  ok: boolean;
  campaigns: Campaign[];
  pending_prospects: Prospect[];
  owners: Owner[];
  landings: Landing[];
  domain_reputation: DomainRep[];
};

const KIND_COLOR: Record<string, string> = {
  product: '#2ddca8',
  brand_deal: '#fbbf24',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  active: '#38bdf8',
  paused: '#f87171',
  completed: '#a78bfa',
};

export default function MarketingDashboard() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch('/api/marketing/list');
      if (!r.ok) {
        setData(null);
        setToast(`Load failed: ${r.status}`);
      } else {
        const j = (await r.json()) as ListResponse;
        setData(j);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(null), 4000);
  };

  const doAction = async (label: string, url: string, init?: RequestInit) => {
    setBusy(label);
    try {
      const r = await authFetch(url, { method: 'POST', ...init });
      const j = await r.json().catch(() => ({}));
      showToast(`${label}: ${r.ok ? 'ok' : 'failed'} — ${JSON.stringify(j).slice(0, 200)}`);
      await load();
    } catch (e) {
      showToast(`${label}: error — ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <div style={pageStyle}>
        <div style={{ padding: 40, color: '#9ba2b8' }}>Loading marketing console…</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <header style={{ padding: '32px 32px 16px', borderBottom: '1px solid #1c2030' }}>
        <Link href="/dashboard" style={{ color: '#9ba2b8', fontSize: 13, textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '12px 0 6px', color: '#fff' }}>
          Federation Marketing
        </h1>
        <p style={{ color: '#9ba2b8', margin: 0, fontSize: 14 }}>
          Owner-network newsletters + brand-deal funnels across the 10 verified domains.
        </p>
      </header>

      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 18px',
            background: 'rgba(20,20,30,0.95)',
            border: '1px solid #2a2f44',
            borderRadius: 10,
            color: '#fff',
            fontSize: 13,
            maxWidth: 480,
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ padding: 32, display: 'grid', gap: 32 }}>
        {/* Audience size + global controls */}
        <Section title={`Owner network (${(data?.owners || []).filter((o) => !o.unsubscribed_at).length} active)`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {(data?.owners || []).map((o) => (
              <div
                key={o.id}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: o.unsubscribed_at ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                  {o.full_name}{' '}
                  <span style={{ color: '#9ba2b8', fontWeight: 400 }}>
                    ({o.first_name})
                  </span>
                </div>
                <div style={{ color: '#9ba2b8', fontSize: 12, marginTop: 4 }}>{o.email}</div>
                <div style={{ color: '#9ba2b8', fontSize: 11, marginTop: 6 }}>
                  {o.role} · {o.business_slugs.join(', ')}
                </div>
                {o.unsubscribed_at ? (
                  <div style={{ color: '#f87171', fontSize: 11, marginTop: 6 }}>
                    Unsubscribed
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>

        {/* Domain reputation */}
        <Section title="Domain reputation (last 30 days)">
          {data?.domain_reputation?.length ? (
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}
            >
              {data.domain_reputation.map((d) => {
                const unhealthy =
                  d.bounce_rate > 0.05 || d.complaint_rate > 0.05 || d.unsubscribe_rate > 0.05;
                return (
                  <div
                    key={d.domain}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${unhealthy ? '#f87171' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{d.domain}</div>
                    <div style={{ color: '#9ba2b8', fontSize: 11, marginTop: 4 }}>
                      {d.sent} sent · bounce {(d.bounce_rate * 100).toFixed(1)}% · spam{' '}
                      {(d.complaint_rate * 100).toFixed(1)}% · unsub{' '}
                      {(d.unsubscribe_rate * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#9ba2b8', fontSize: 13 }}>
              No sends in last 30 days. Reputation dials light up after first send.
            </div>
          )}
        </Section>

        {/* Campaigns */}
        <Section title={`Campaigns (${data?.campaigns?.length || 0})`}>
          {data?.campaigns?.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {data.campaigns.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Pill text={c.kind} color={KIND_COLOR[c.kind]} />
                    <Pill text={c.status} color={STATUS_COLOR[c.status]} />
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                      {c.business_slug}
                    </div>
                    <div style={{ color: '#9ba2b8', fontSize: 12 }}>
                      {c.sender_display} &lt;{c.sender_email}&gt;
                    </div>
                  </div>
                  <div style={{ color: '#cfd3e0', fontSize: 13, margin: '8px 0' }}>
                    Subject: {c.subject_template}
                  </div>
                  <div style={{ color: '#9ba2b8', fontSize: 12, marginBottom: 12 }}>
                    Audience: {c.audience_kind} · Reply-to: {c.reply_to_email} · Throttle:{' '}
                    {c.daily_throttle}/day, {c.hourly_throttle}/hr
                  </div>

                  {c.stats ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, minmax(0,1fr))',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <Stat label="Scheduled" value={c.stats.scheduled} />
                      <Stat label="Sent" value={c.stats.sent} />
                      <Stat label="Opened" value={c.stats.opened} />
                      <Stat label="Clicked" value={c.stats.clicked} />
                      <Stat label="Bounced" value={c.stats.bounced} fg="#f87171" />
                      <Stat label="Complaint" value={c.stats.complained} fg="#f87171" />
                      <Stat label="Unsub" value={c.stats.unsubscribed} fg="#f87171" />
                      <Stat label="Suppressed" value={c.stats.suppressed} fg="#9ba2b8" />
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      disabled={busy !== null}
                      style={btnStyle}
                      onClick={() =>
                        doAction(
                          `dry-run ${c.business_slug}`,
                          `/api/marketing/campaign?action=enqueue&campaign_id=${c.id}&dry_run=true`,
                        )
                      }
                    >
                      Dry-run enqueue
                    </button>
                    <button
                      disabled={busy !== null}
                      style={btnStyle}
                      onClick={() => {
                        if (!confirm(`Enqueue real sends for ${c.business_slug}?`)) return;
                        doAction(
                          `enqueue ${c.business_slug}`,
                          `/api/marketing/campaign?action=enqueue&campaign_id=${c.id}&dry_run=false`,
                        );
                      }}
                    >
                      Enqueue (real)
                    </button>
                    <button
                      disabled={busy !== null}
                      style={{ ...btnStyle, background: '#9C27B0' }}
                      onClick={() => {
                        if (!confirm(`Fire due sends for ${c.business_slug}?`)) return;
                        doAction(
                          `run ${c.business_slug}`,
                          `/api/marketing/campaign?action=run&campaign_id=${c.id}`,
                        );
                      }}
                    >
                      Run now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9ba2b8', fontSize: 13 }}>
              No campaigns yet. Seed via direct SQL or extend this UI with a create form.
            </div>
          )}
        </Section>

        {/* Brand-deal approval queue */}
        <Section title={`Brand-deal approval queue (${data?.pending_prospects?.length || 0})`}>
          {data?.pending_prospects?.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.pending_prospects.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                      {p.first_name || '—'} · {p.prospect_email}
                    </div>
                    <div style={{ color: '#9ba2b8', fontSize: 11 }}>
                      target: {p.target_business_slug} · {p.role || '—'} @ {p.company || '—'} ·{' '}
                      source: {p.source}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      disabled={busy !== null}
                      style={{ ...btnStyle, background: '#2ddca8', color: '#0a1d18' }}
                      onClick={() =>
                        doAction(
                          `approve ${p.prospect_email}`,
                          `/api/marketing/campaign?action=approve_prospect`,
                          {
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prospect_id: p.id }),
                          },
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy !== null}
                      style={{ ...btnStyle, background: '#f87171', color: '#1c0707' }}
                      onClick={() =>
                        doAction(
                          `reject ${p.prospect_email}`,
                          `/api/marketing/campaign?action=reject_prospect`,
                          {
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prospect_id: p.id }),
                          },
                        )
                      }
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9ba2b8', fontSize: 13 }}>
              No brand-deal prospects awaiting approval.
            </div>
          )}
        </Section>

        {/* Landings */}
        <Section title={`Landings (${data?.landings?.length || 0})`}>
          {data?.landings?.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.landings.map((l) => (
                <div
                  key={l.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                      {l.headline}
                    </div>
                    <div style={{ color: '#9ba2b8', fontSize: 11 }}>
                      /p/{l.business_slug}/{l.slug} · {l.kind} · {l.status}
                    </div>
                  </div>
                  <a
                    href={`/p/${l.business_slug}/${l.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#9C27B0', fontSize: 12, textDecoration: 'none' }}
                  >
                    Open ↗
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9ba2b8', fontSize: 13 }}>No landings yet.</div>
          )}
        </Section>

        <div style={{ color: '#666', fontSize: 11 }}>
          Tip: trigger the runner with{' '}
          <code style={{ color: '#cfd3e0' }}>POST /api/marketing/runner</code> (Bearer
          CRON_SECRET) to flush every due send, not just one campaign.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>{title}</h2>
      {children}
    </section>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 999,
        background: `${color}1c`,
        color,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {text}
    </span>
  );
}

function Stat({ label, value, fg = '#fff' }: { label: string; value: number; fg?: string }) {
  return (
    <div>
      <div style={{ color: '#9ba2b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: fg, fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0c14',
  color: '#e7eaf5',
  fontFamily: 'system-ui,-apple-system,Segoe UI,sans-serif',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  background: '#2a2f44',
  color: '#fff',
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

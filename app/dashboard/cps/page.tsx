/**
 * /dashboard/cps — CPS-only analytics + leads view.
 *
 * Server component. Auth-gated by middleware.ts (any signed-in user can
 * see the page; public site is gated). Reads from cps_events and
 * cps_leads tables with the service-role admin client so RLS doesn't
 * filter out rows. The route is intentionally focused — leads, calls
 * counted (tel: clicks), top pages, today/week/month roll-ups.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { Phone, Mail, ExternalLink, TrendingUp, MousePointerClick, Eye, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string;
  page_path: string | null;
  page_url: string | null;
  status: string;
  email_notified: boolean;
  telegram_notified: boolean;
  created_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  event_category: string;
  action: string;
  target_id: string | null;
  page_path: string | null;
  is_phone_click: boolean;
  phone_number: string | null;
  visitor_id: string | null;
  session_id: string | null;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function loadData() {
  const sb = createAdminClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const since30d = new Date(now - 30 * DAY_MS).toISOString();
  const sinceToday = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();

  const [
    { data: recentLeads },
    { count: leadsToday },
    { count: leads7d },
    { count: leads30d },
    { data: recentEvents },
    { count: pageViews7d },
    { count: clicks7d },
    { count: phoneClicksToday },
    { count: phoneClicks7d },
    { data: topPagesRaw },
    { data: topClicksRaw },
    { data: phoneClickRows },
  ] = await Promise.all([
    sb
      .from('cps_leads')
      .select('id, name, email, phone, message, source, page_path, page_url, status, email_notified, telegram_notified, created_at')
      .order('created_at', { ascending: false })
      .limit(25),

    sb.from('cps_leads').select('*', { count: 'exact', head: true }).gte('created_at', sinceToday),
    sb.from('cps_leads').select('*', { count: 'exact', head: true }).gte('created_at', since7d),
    sb.from('cps_leads').select('*', { count: 'exact', head: true }).gte('created_at', since30d),

    sb
      .from('cps_events')
      .select('id, event_type, event_category, action, target_id, page_path, is_phone_click, phone_number, visitor_id, session_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50),

    sb.from('cps_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', since7d),
    sb.from('cps_events').select('*', { count: 'exact', head: true }).eq('event_type', 'click').gte('created_at', since7d),
    sb.from('cps_events').select('*', { count: 'exact', head: true }).eq('is_phone_click', true).gte('created_at', sinceToday),
    sb.from('cps_events').select('*', { count: 'exact', head: true }).eq('is_phone_click', true).gte('created_at', since7d),

    sb
      .from('cps_events')
      .select('page_path')
      .eq('event_type', 'page_view')
      .gte('created_at', since7d)
      .not('page_path', 'is', null)
      .limit(2000),

    sb
      .from('cps_events')
      .select('target_id')
      .eq('event_type', 'click')
      .gte('created_at', since7d)
      .not('target_id', 'is', null)
      .limit(2000),

    sb
      .from('cps_events')
      .select('phone_number, page_path, created_at')
      .eq('is_phone_click', true)
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Tally top pages.
  const pageTally = new Map<string, number>();
  (topPagesRaw || []).forEach((r: { page_path: string | null }) => {
    if (!r.page_path) return;
    pageTally.set(r.page_path, (pageTally.get(r.page_path) || 0) + 1);
  });
  const topPages = Array.from(pageTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Tally top buttons clicked.
  const clickTally = new Map<string, number>();
  (topClicksRaw || []).forEach((r: { target_id: string | null }) => {
    if (!r.target_id) return;
    const key = r.target_id.slice(0, 60);
    clickTally.set(key, (clickTally.get(key) || 0) + 1);
  });
  const topClicks = Array.from(clickTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Unique visitors / sessions in 7d (from recent events sample).
  const visitorIds = new Set<string>();
  const sessionIds = new Set<string>();
  (recentEvents || []).forEach((e: EventRow) => {
    if (e.visitor_id) visitorIds.add(e.visitor_id);
    if (e.session_id) sessionIds.add(e.session_id);
  });

  return {
    recentLeads: (recentLeads || []) as Lead[],
    leadsToday: leadsToday || 0,
    leads7d: leads7d || 0,
    leads30d: leads30d || 0,
    recentEvents: (recentEvents || []) as EventRow[],
    pageViews7d: pageViews7d || 0,
    clicks7d: clicks7d || 0,
    phoneClicksToday: phoneClicksToday || 0,
    phoneClicks7d: phoneClicks7d || 0,
    topPages,
    topClicks,
    phoneClickRows: (phoneClickRows || []) as { phone_number: string | null; page_path: string | null; created_at: string }[],
    uniqueVisitorsSample: visitorIds.size,
    uniqueSessionsSample: sessionIds.size,
  };
}

export default async function CpsDashboardPage() {
  const data = await loadData();

  const stats = [
    { label: 'Leads today', value: data.leadsToday, icon: Users, accent: 'text-emerald-400' },
    { label: 'Leads this week', value: data.leads7d, icon: TrendingUp, accent: 'text-emerald-400' },
    { label: 'Calls today (tel: clicks)', value: data.phoneClicksToday, icon: Phone, accent: 'text-blue-400' },
    { label: 'Calls this week', value: data.phoneClicks7d, icon: Phone, accent: 'text-blue-400' },
    { label: 'Page views (7d)', value: data.pageViews7d, icon: Eye, accent: 'text-violet-400' },
    { label: 'Button clicks (7d)', value: data.clicks7d, icon: MousePointerClick, accent: 'text-violet-400' },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-12">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-widest text-violet-400 font-semibold mb-2">
            Client Dashboard
          </p>
          <h1 className="text-4xl font-black mb-2">CPS — Comprehensive Psychological Services</h1>
          <p className="text-white/60">
            Live analytics + lead intake from psychandcustodyevaluations.com.
            Refreshes on every load.
          </p>
        </header>

        {/* Stat cards ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Icon className={`w-5 h-5 mb-4 ${s.accent}`} aria-hidden />
                <div className="text-3xl font-black mb-1">{s.value.toLocaleString()}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">{s.label}</div>
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Recent leads ───────────────────────────────────────── */}
          <section className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Recent leads</h2>
              <span className="text-xs text-white/40">{data.recentLeads.length} shown</span>
            </div>
            {data.recentLeads.length === 0 ? (
              <p className="text-sm text-white/50">No leads yet. They will appear here the moment a CPS contact form is submitted.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentLeads.map((l) => (
                  <li key={l.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold truncate">{l.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 uppercase tracking-wider">
                            {l.status}
                          </span>
                          <span className="text-xs text-white/40">via {l.source}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-white/70">
                          {l.phone && (
                            <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-white">
                              <Phone className="w-3.5 h-3.5" aria-hidden /> {l.phone}
                            </a>
                          )}
                          {l.email && (
                            <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-white">
                              <Mail className="w-3.5 h-3.5" aria-hidden /> {l.email}
                            </a>
                          )}
                          {l.page_path && (
                            <span className="inline-flex items-center gap-1 text-white/40">
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden /> {l.page_path}
                            </span>
                          )}
                        </div>
                        {l.message && (
                          <p className="mt-2 text-sm text-white/70 line-clamp-2 whitespace-pre-wrap">{l.message}</p>
                        )}
                      </div>
                      <div className="text-xs text-white/40 whitespace-nowrap">{fmtTime(l.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Calls received ─────────────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">Calls received</h2>
            <p className="text-xs text-white/50 mb-6">tel: link clicks (last 7 days)</p>
            {data.phoneClickRows.length === 0 ? (
              <p className="text-sm text-white/50">No phone clicks tracked yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.phoneClickRows.map((r, i) => (
                  <li key={i} className="text-sm flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="inline-flex items-center gap-2 text-white/80">
                      <Phone className="w-3.5 h-3.5 text-blue-400" aria-hidden />
                      {r.phone_number || '(801) 483-1600'}
                    </span>
                    <span className="text-xs text-white/40">{r.page_path || '/'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* Top pages ──────────────────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">Top pages</h2>
            <p className="text-xs text-white/50 mb-6">By page views, last 7 days</p>
            {data.topPages.length === 0 ? (
              <p className="text-sm text-white/50">No page views tracked yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.topPages.map(([path, count]) => (
                  <li key={path} className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-sm text-white/80 truncate mr-4">{path}</span>
                    <span className="text-sm font-semibold text-violet-300">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top buttons clicked ────────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">Top buttons clicked</h2>
            <p className="text-xs text-white/50 mb-6">By click count, last 7 days</p>
            {data.topClicks.length === 0 ? (
              <p className="text-sm text-white/50">No clicks tracked yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.topClicks.map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-sm text-white/80 truncate mr-4">{label}</span>
                    <span className="text-sm font-semibold text-emerald-300">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Recent events feed ─────────────────────────────────────── */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold">Live event feed</h2>
              <p className="text-xs text-white/50 mt-1">Most recent 50 events</p>
            </div>
            <div className="text-xs text-white/40">
              {data.uniqueVisitorsSample} visitors · {data.uniqueSessionsSample} sessions in sample
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-white/40 uppercase tracking-wider border-b border-white/10">
                  <th className="text-left font-semibold py-2">Time</th>
                  <th className="text-left font-semibold py-2">Type</th>
                  <th className="text-left font-semibold py-2">Target</th>
                  <th className="text-left font-semibold py-2">Page</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="py-2 text-white/50 whitespace-nowrap">{fmtTime(e.created_at)}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.is_phone_click ? 'bg-blue-500/15 text-blue-300' : e.event_type === 'form_submit' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/70'}`}>
                        {e.is_phone_click ? 'phone_click' : e.event_type}
                      </span>
                    </td>
                    <td className="py-2 text-white/80 max-w-[280px] truncate">{e.target_id || '—'}</td>
                    <td className="py-2 text-white/50 max-w-[200px] truncate">{e.page_path || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

import { createAdminClient } from '@/lib/supabase/admin';

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n}`;

export interface ClientReviewData {
  client: any;
  metrics: Array<{ date: string; mrr_usd: number; arr_usd: number }>;
  ships: Array<{ title: string; kind: string; created_at: string; detail: string | null; unlocks: string | null }>;
  risks: Array<{ title: string; detail: string | null; severity: string; resolved_at: string | null; opened_at: string }>;
}

export async function gatherClientReview(slug: string): Promise<ClientReviewData | null> {
  const supabase = createAdminClient();
  const [{ data: client }, { data: metrics }, { data: ships }, { data: risks }] = await Promise.all([
    supabase.from('client_portfolio').select('*').eq('slug', slug).maybeSingle(),
    supabase
      .from('client_metrics_daily')
      .select('date, mrr_usd, arr_usd')
      .eq('client_slug', slug)
      .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
      .order('date', { ascending: true }),
    supabase
      .from('build_log')
      .select('title, kind, created_at, detail, unlocks')
      .eq('client_slug', slug)
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('client_risks')
      .select('title, detail, severity, resolved_at, opened_at')
      .eq('client_slug', slug)
      .order('opened_at', { ascending: false }),
  ]);
  if (!client) return null;
  return { client, metrics: metrics || [], ships: ships || [], risks: risks || [] };
}

function chart(points: number[], width = 600, height = 180): string {
  if (points.length < 2) return `<div style="height:${height}px;background:rgba(255,255,255,.02);border-radius:8px;"></div>`;
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = max - min || 1;
  const pts = points
    .map((v, i) => `${(i / (points.length - 1)) * width},${height - ((v - min) / range) * (height - 20) - 10}`)
    .join(' ');
  return `<svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="display:block;">
    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(16,185,129)" stop-opacity=".4"/>
      <stop offset="100%" stop-color="rgb(16,185,129)" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="0,${height} ${pts} ${width},${height}" fill="url(#g1)"/>
    <polyline points="${pts}" fill="none" stroke="rgb(16,185,129)" stroke-width="2"/>
  </svg>`;
}

export function buildClientReviewHtml(d: ClientReviewData): string {
  const c = d.client;
  const mrrPoints = d.metrics.map((m) => m.mrr_usd || 0);
  const target = c.arr_target_usd || 1_000_000;
  const progress = Math.min(100, Math.round(((c.current_arr_usd || 0) / target) * 100));
  const reviewDate = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  const shipsByMonth: Record<string, number> = {};
  for (const s of d.ships) {
    const k = s.created_at.slice(0, 7);
    shipsByMonth[k] = (shipsByMonth[k] || 0) + 1;
  }

  const byKind: Record<string, number> = {};
  for (const s of d.ships) byKind[s.kind] = (byKind[s.kind] || 0) + 1;

  const timelineHtml = d.ships
    .slice(-30)
    .reverse()
    .map(
      (s) => `
      <li style="padding:8px 0;border-bottom:1px solid #1f2937;">
        <span style="font-family:monospace;font-size:10px;color:#10b981;text-transform:uppercase;">${s.kind}</span>
        · <span style="font-size:10px;color:#6b7280;">${s.created_at.slice(0, 10)}</span>
        <div style="font-size:14px;color:#e5e7eb;margin-top:2px;">${s.title}</div>
        ${s.detail ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${s.detail}</div>` : ''}
        ${s.unlocks ? `<div style="font-size:11px;color:#10b981;margin-top:2px;">→ unlocks: ${s.unlocks}</div>` : ''}
      </li>`
    )
    .join('');

  const openRisks = d.risks.filter((r) => !r.resolved_at);
  const risksHtml = openRisks.length
    ? openRisks
        .map(
          (r) => `
        <li style="padding:10px 12px;margin-bottom:8px;border-radius:8px;background:${r.severity === 'red' ? 'rgba(239,68,68,.08)' : 'rgba(251,191,36,.06)'};border-left:3px solid ${r.severity === 'red' ? '#ef4444' : '#f59e0b'};">
          <div style="font-size:14px;color:#fff;">${r.title}</div>
          ${r.detail ? `<div style="font-size:12px;color:#9ca3af;margin-top:4px;">${r.detail}</div>` : ''}
        </li>`
        )
        .join('')
    : '<p style="color:#10b981;font-size:14px;">🟢 No open risks.</p>';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${c.name} · Investor Review · ${reviewDate}</title>
<style>
  body{margin:0;background:#030305;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}
  .wrap{max-width:820px;margin:0 auto;padding:48px 32px;}
  .cover{text-align:center;padding:80px 20px;border-radius:16px;background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(6,182,212,.06));border:1px solid rgba(16,185,129,.2);margin-bottom:32px;}
  .kpi{display:flex;gap:32px;flex-wrap:wrap;padding:24px;border-radius:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);margin-bottom:32px;}
  .kpi > div{flex:1;min-width:120px;}
  .kpi .v{font-size:32px;font-weight:700;color:#10b981;}
  .kpi .l{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;font-family:monospace;}
  h2{font-size:16px;color:#10b981;text-transform:uppercase;letter-spacing:.15em;font-family:monospace;margin:40px 0 12px;}
  .section{padding:20px;border-radius:12px;background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.05);margin-bottom:16px;}
</style></head>
<body>
<div class="wrap">

  <div class="cover">
    <div style="font-size:64px;margin-bottom:8px;">${c.emoji || '📦'}</div>
    <h1 style="font-size:40px;font-weight:800;margin:0 0 8px;color:#fff;">${c.name}</h1>
    <p style="font-size:14px;color:#9ca3af;margin:0 0 20px;">Investor Review · ${reviewDate}</p>
    <p style="font-size:13px;color:#6b7280;margin:0;font-family:monospace;">Stack: ${c.stack || '—'} · Status: ${c.status}</p>
  </div>

  <div class="kpi">
    <div><div class="v">${fmtMoney(c.current_arr_usd || 0)}</div><div class="l">ARR</div></div>
    <div><div class="v" style="color:#06b6d4;">${fmtMoney(c.current_mrr_usd || 0)}</div><div class="l">MRR</div></div>
    <div><div class="v" style="color:#fbbf24;">${c.customer_count || 0}</div><div class="l">Customers</div></div>
    <div><div class="v" style="color:#a78bfa;">${progress}%</div><div class="l">→ ${fmtMoney(target)}</div></div>
    <div><div class="v" style="color:#fff;">${d.ships.length}</div><div class="l">Ships · 90d</div></div>
  </div>

  <h2>90-Day MRR Trajectory</h2>
  <div class="section">${chart(mrrPoints)}</div>

  <h2>Ship Velocity · by kind</h2>
  <div class="section">
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      ${Object.entries(byKind)
        .map(
          ([k, n]) =>
            `<span style="padding:6px 12px;border-radius:999px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);font-family:monospace;font-size:12px;color:#10b981;">${k} · ${n}</span>`
        )
        .join('')}
      ${d.ships.length === 0 ? '<p style="color:#6b7280;font-size:14px;">No ships logged yet.</p>' : ''}
    </div>
  </div>

  <h2>Ship Timeline · last 30</h2>
  <div class="section"><ul style="list-style:none;padding:0;margin:0;">${timelineHtml || '<li style="color:#6b7280;">No ships in review window.</li>'}</ul></div>

  <h2>Open Risks</h2>
  <div class="section"><ul style="list-style:none;padding:0;margin:0;">${risksHtml}</ul></div>

  <h2>Next Quarter Plan</h2>
  <div class="section">
    <p style="font-size:14px;color:#d1d5db;line-height:1.6;">
      Execution focus for the next 90 days:
    </p>
    <ol style="font-size:14px;color:#d1d5db;line-height:1.8;padding-left:20px;">
      <li>Grow ARR from <strong style="color:#10b981;">${fmtMoney(c.current_arr_usd || 0)}</strong> toward <strong style="color:#10b981;">${fmtMoney(Math.max((c.current_arr_usd || 0) * 2, 100000))}</strong> (2× or $100K floor).</li>
      <li>Ship at minimum <strong>2 revenue-generating features per month</strong> logged in build_log.</li>
      <li>Close every open red risk within 14 days of opening.</li>
      <li>Install automated lead intake + SDR follow-up so pipeline compounds without manual touch.</li>
    </ol>
  </div>

  <p style="text-align:center;font-size:11px;color:#6b7280;margin-top:48px;font-family:monospace;">
    OMNI AI · CEO OPS SUITE · ${reviewDate}
  </p>
</div>
</body></html>`;
}

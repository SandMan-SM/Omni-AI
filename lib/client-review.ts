import { createAdminClient } from '@/lib/supabase/admin';
import {
  wrapper,
  header,
  kpiRow,
  callout,
  sectionHeading,
  section,
  listRow,
  ctaBlock,
  footer,
  fmtMoney,
  THEME,
  accentColor,
} from '@/lib/email-template';

// Rendering rules: docs/email-design-system.md. Don't inline layout HTML.

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

/**
 * Render a 90-day MRR chart as an inline SVG inside a bg-surface card.
 * Kept simple + email-safe: `width="100%" height="auto" viewBox="..."`.
 * Gmail and Apple Mail both render inline SVG. Outlook desktop falls back to
 * an empty box — we accept that; the KPI row above carries the same story.
 */
function sparkSvg(points: number[], accent: string): string {
  const W = 600;
  const H = 160;
  if (points.length < 2) {
    return `<div style="height:${H}px;background:${THEME.surfaceRaised};border-radius:8px;"></div>`;
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = max - min || 1;
  const coords = points
    .map((v, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * (H - 24) - 12).toFixed(1)}`)
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;">
    <polygon points="0,${H} ${coords} ${W},${H}" fill="${accent}" fill-opacity="0.14"/>
    <polyline points="${coords}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

export function buildClientReviewHtml(d: ClientReviewData): string {
  const c = d.client;
  const reviewDate = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const target = c.arr_target_usd || 1_000_000;
  const progressPct = Math.min(100, Math.round(((c.current_arr_usd || 0) / target) * 100));
  const mrrPoints = d.metrics.map((m) => m.mrr_usd || 0);

  // Ships grouped by kind for the velocity chip row
  const byKind: Record<string, number> = {};
  for (const s of d.ships) byKind[s.kind] = (byKind[s.kind] || 0) + 1;

  const openRisks = d.risks.filter((r) => !r.resolved_at);

  // KPI row
  const kpis = kpiRow([
    { value: fmtMoney(c.current_arr_usd || 0), label: 'ARR', color: THEME.green },
    { value: fmtMoney(c.current_mrr_usd || 0), label: 'MRR', color: THEME.cyan },
    { value: String(c.customer_count || 0), label: 'Customers', color: THEME.textPrimary },
    { value: `${progressPct}%`, label: `→ ${fmtMoney(target)}`, color: THEME.amber },
    { value: String(d.ships.length), label: 'Ships · 90d', color: THEME.textPrimary },
  ]);

  // Progress bar (flat hex, table-based)
  const progressBar = `
<tr><td style="padding:0 0 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${THEME.surface};border:1px solid ${THEME.border};border-radius:12px;">
    <tr><td style="padding:18px 22px;">
      <p style="margin:0 0 10px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${THEME.textSubtle};">Progress to $${(target / 1_000_000).toFixed(1)}M ARR target</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${THEME.surfaceRaised};border-radius:6px;">
        <tr>
          <td width="${progressPct}%" style="background:${THEME.green};height:10px;border-radius:6px 0 0 6px;font-size:0;line-height:0;">&nbsp;</td>
          <td width="${100 - progressPct}%" style="font-size:0;line-height:0;">&nbsp;</td>
        </tr>
      </table>
      <p style="margin:10px 0 0;font-size:13px;color:${THEME.textMuted};">
        <strong style="color:${THEME.green};">${fmtMoney(c.current_arr_usd || 0)}</strong>
        <span style="color:${THEME.textSubtle};"> of </span>
        <strong style="color:${THEME.textPrimary};">${fmtMoney(target)}</strong>
        <span style="color:${THEME.textSubtle};"> — ${progressPct}% complete</span>
      </p>
    </td></tr>
  </table>
</td></tr>`;

  // 90-day trajectory (inline SVG inside surface card)
  const chartCard = section(
    mrrPoints.length >= 2
      ? sparkSvg(mrrPoints, THEME.green)
      : `<p style="margin:0;font-size:14px;color:${THEME.textMuted};text-align:center;padding:40px 0;">Not enough history yet. Back to you in ${90 - mrrPoints.length} days.</p>`,
    { padding: '16px 16px' }
  );

  // Velocity-by-kind chips
  const chips = Object.entries(byKind)
    .map(
      ([k, n]) =>
        `<span style="display:inline-block;margin:4px 6px 4px 0;padding:6px 12px;font-family:${THEME.fontMono};font-size:11px;letter-spacing:0.05em;background:${THEME.greenBg};color:${THEME.green};border:1px solid ${THEME.border};border-radius:999px;">${esc(k)} · ${n}</span>`
    )
    .join('');
  const velocityCard = section(
    chips || `<p style="margin:0;font-size:14px;color:${THEME.textMuted};">No ships logged yet in the 90-day window.</p>`
  );

  // Ship timeline (last 30, chronological newest first)
  const timelineBody = d.ships
    .slice(-30)
    .reverse()
    .map((s) =>
      listRow({
        kind: s.kind,
        when: s.created_at.slice(0, 10),
        title: s.title,
        detail: s.detail || undefined,
        unlocks: s.unlocks || undefined,
        accent: 'green',
      })
    )
    .join('');
  const timelineCard = section(
    timelineBody
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${timelineBody}</table>`
      : `<p style="margin:0;font-size:14px;color:${THEME.textMuted};">No ships in the review window.</p>`,
    { padding: '6px 22px' }
  );

  // Risks
  const risksInner = openRisks.length
    ? openRisks
        .map((r) => {
          const acc = r.severity === 'red' ? THEME.red : THEME.amber;
          const bg = r.severity === 'red' ? '#2d1215' : '#2a1f0a';
          return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background:${bg};border-left:3px solid ${acc};border-radius:8px;">
  <tr><td style="padding:12px 16px;">
    <div style="font-size:14px;font-weight:700;color:${THEME.textPrimary};">${esc(r.title)}</div>
    ${r.detail ? `<div style="margin-top:4px;font-size:13px;color:${THEME.textMuted};line-height:1.55;">${esc(r.detail)}</div>` : ''}
    <div style="margin-top:6px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${acc};">severity: ${r.severity}</div>
  </td></tr>
</table>`;
        })
        .join('')
    : `<p style="margin:0;font-size:14px;color:${THEME.green};">🟢 No open risks. Ship into the open field.</p>`;
  const risksCard = section(risksInner);

  // Next quarter plan
  const nextArr = Math.max((c.current_arr_usd || 0) * 2, 100000);
  const planInner = `
<p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${THEME.text};">Execution focus for the next 90 days:</p>
<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.85;color:${THEME.text};">
  <li>Grow ARR from <strong style="color:${THEME.green};">${fmtMoney(c.current_arr_usd || 0)}</strong> toward <strong style="color:${THEME.green};">${fmtMoney(nextArr)}</strong> (2× or $100K floor).</li>
  <li>Ship at least <strong>2 revenue-generating features per month</strong>, each logged in build_log with an unlock line.</li>
  <li>Close every open red risk within 14 days of opening.</li>
  <li>Install automated lead intake + SDR follow-up so pipeline compounds without manual touch.</li>
</ol>`;
  const planCard = section(planInner);

  const body = [
    header({
      eyebrow: `${c.emoji || '📦'} Investor Review`,
      title: c.name,
      meta: `${reviewDate} · Stack: ${c.stack || '—'} · Status: ${c.status}`,
      accent: 'green',
    }),
    kpis,
    progressBar,
    callout(
      'One thing to fix this week',
      c.next_move
        ? `<strong style="color:${THEME.textPrimary};">${esc(c.next_move)}</strong>`
        : openRisks[0]
          ? `Resolve <strong style="color:${THEME.textPrimary};">${esc(openRisks[0].title)}</strong> — the highest-severity open risk.`
          : `Pick the single action that moves ARR toward <strong style="color:${THEME.textPrimary};">${fmtMoney(nextArr)}</strong> this week. Ship it before Friday.`,
      'amber'
    ),
    sectionHeading('90-day MRR trajectory', 'green'),
    chartCard,
    sectionHeading('Ship velocity · by kind', 'green'),
    velocityCard,
    sectionHeading('Ship timeline · last 30', 'green'),
    timelineCard,
    sectionHeading('Open risks', 'red'),
    risksCard,
    sectionHeading('Next quarter plan', 'green'),
    planCard,
    ctaBlock({
      tagline: 'Open the live client page in Command Center to drill in.',
      primary: { href: `https://omnileadsagi.com/command/client/${c.slug}`, label: 'Open client page', accent: 'green' },
      secondary: { href: `https://omnileadsagi.com/api/portfolio/review/${c.slug}?format=json`, label: 'Raw data' },
    }),
    footer({
      tagline: 'Omni AI · Portfolio Review',
      links: [
        { label: 'Command Center', href: 'https://omnileadsagi.com/command' },
        { label: 'Book a working session', href: 'https://omnileadsagi.com/book-now' },
      ],
    }),
  ].join('');

  return wrapper({
    title: `${c.name} · Investor Review · ${reviewDate}`,
    preheader: `${c.name}: ${fmtMoney(c.current_arr_usd || 0)} ARR · ${progressPct}% to ${fmtMoney(target)} · ${d.ships.length} ships in 90d · ${openRisks.length} open risks`,
    body,
  });
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string);
}

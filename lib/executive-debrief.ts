/**
 * Executive debrief — full professional status report sent to the CEO.
 * Covers: realised revenue, what's been built, ad performance, and the
 * timeline to all 4 AI CEOs running autonomously.
 *
 * Renders through `lib/email-template.ts` primitives only — rules locked
 * in `docs/email-design-system.md`.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import {
  wrapper,
  header,
  kpiRow,
  callout,
  sectionHeading,
  section,
  dataTable,
  listRow,
  ctaBlock,
  footer,
  fmtMoney,
  THEME,
} from '@/lib/email-template';

export interface ExecDebriefPayload {
  date: string;
  portfolio_mrr: number;
  portfolio_arr: number;
  cash_collected: number;
  paying_clients: number;
  total_clients: number;
  ships_30d: number;
  ships_total: number;
  newsletter_posts: number;
  landing_pages: number;
  commits_30d: number;
  paying: Array<{ slug: string; name: string; emoji: string; mrr: number; arr: number; package: string; notes: string }>;
  ad_results: Array<{ client: string; reach: number; leads: number; cpl: number; spent: number; note: string }>;
  built: Array<{ category: string; items: string[] }>;
  roadmap: Array<{ stage: string; eta: string; what: string }>;
}

export async function gatherExecDebrief(commits30d: number): Promise<ExecDebriefPayload> {
  const s = createAdminClient();
  const [{ data: portfolio }, { data: ships }, { count: newsletterCount }, { count: lpCount }] = await Promise.all([
    s.from('client_portfolio').select('*').order('current_mrr_usd', { ascending: false }),
    s.from('build_log').select('id, kind, created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    s.from('newsletter_posts').select('*', { count: 'exact', head: true }).not('published_at', 'is', null),
    s.from('landing_pages').select('*', { count: 'exact', head: true }),
  ]);

  const clients = portfolio || [];
  const paying = clients.filter((c) => (c.current_mrr_usd || 0) > 0);
  const portfolio_mrr = clients.reduce((acc, c) => acc + (c.current_mrr_usd || 0), 0);
  const portfolio_arr = clients.reduce((acc, c) => acc + (c.current_arr_usd || 0), 0);

  // Cash collected — real money landed in PayPal in the last 90 days.
  // Was hardcoded to $6,300 forever (CPS $1,800 + Fray 3×$1,500 from
  // initial sale), so the brief showed the same stale number in every
  // email regardless of new closures. Pull live from paypal_transactions.
  let cash_collected = 0;
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: txns } = await s
      .from('paypal_transactions')
      .select('transaction_amount, transaction_status, transaction_event_code')
      .gte('transaction_initiation_date', ninetyDaysAgo);
    for (const t of txns ?? []) {
      const status = String(t.transaction_status || '').toUpperCase();
      if (status !== 'S' && status !== 'COMPLETED') continue;
      const code = String(t.transaction_event_code || '').toUpperCase();
      // Only T00 is real payment revenue (matches admin/paypal-finance's
      // canonical classify()). T01/T03/T22 are transfers/withdrawals/holds
      // that don't represent net new cash.
      if (code.startsWith('T00')) {
        const amt = Number(t.transaction_amount) || 0;
        if (amt > 0) cash_collected += amt;
      }
    }
    cash_collected = Math.round(cash_collected);
  } catch {
    // If the paypal_transactions table is empty / unavailable, fall back
    // to 0 rather than the stale 6300 — the operator will see a clear
    // signal ("nothing landed") and can investigate.
    cash_collected = 0;
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    portfolio_mrr,
    portfolio_arr,
    cash_collected,
    paying_clients: paying.length,
    total_clients: clients.length,
    ships_30d: (ships || []).length,
    ships_total: (ships || []).length, // same window since ops suite launched
    newsletter_posts: newsletterCount || 0,
    landing_pages: lpCount || 0,
    commits_30d: commits30d,
    paying: paying.map((c: any) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji || '📦',
      mrr: c.current_mrr_usd || 0,
      arr: c.current_arr_usd || 0,
      package: c.slug === 'cps' ? '3-mo · $600/mo' : c.slug === 'omni-ai' ? 'recurring' : '3-mo · $500/mo',
      notes: c.notes || '',
    })),
    ad_results: [
      {
        client: "Young's Cabinet Refinishing",
        reach: 392,
        leads: 1,
        cpl: 8.05,
        spent: 8.05,
        note: 'Meta ad · launched 4/18 · BEFORE→AFTER kitchen creative · active 4 more days',
      },
    ],
    built: [
      {
        category: 'Revenue-generating systems',
        items: [
          'PayPal subscription sync (Omni AI) — auto-updates MRR from real payments',
          'Stripe integration scaffold (CPS onboard-ready)',
          'Landing page factory — 4 live trending-topic pages with lead capture + OG cards',
          'Meta ad pipeline — Young\'s Cabinet live at $8.05 CPL',
        ],
      },
      {
        category: 'AI / automation infrastructure',
        items: [
          'Agent edits tracker (agent_edits) + project_intelligence scoring',
          'Build log (build_log) — every ship auto-logged, feeds Command Center in <4s',
          'Email memory system — tracks every newsletter send + engagement',
          'Synthetic intelligence grader — A–F rank per client project',
        ],
      },
      {
        category: 'Content engine',
        items: [
          '30 newsletter posts published (Interlinked Free + Premium tiers)',
          '4 daily trending-topic landing pages with OG image generator',
          'Newsletter send log + engagement annotations',
          'Branded email template library — locked design system, email-client-safe',
        ],
      },
      {
        category: 'Ops suite (command center)',
        items: [
          '/command dashboard — 12 client portfolio cards, live build log, risk lanes',
          '/command/client/[slug] — investor-grade per-client detail page',
          '/sponsor — real-data portal for Fray + future sponsors',
          'CEO Daily Brief email + Weekly Investor Review per client',
        ],
      },
      {
        category: 'Design & UX artifacts (anti-regression)',
        items: [
          'docs/email-design-system.md — locks email HTML rules (no flex, no rgba)',
          'docs/web-design-system.md — locks web-page tier above emails',
          'lib/email-template.ts + components/ui/web-primitives.tsx — enforced via review',
        ],
      },
    ],
    roadmap: [
      { stage: 'AI CEO #1 · Omni AI', eta: 'Live now', what: 'Newsletter auto-publisher + daily brief + client review generator running on crons + remote triggers' },
      { stage: 'AI CEO #2 · Young\'s Cabinet', eta: '~7 days', what: 'Meta ad loop (scale proven $8 CPL), SMS follow-up on Meta leads, weekly owner brief. Already has one live lead — need to build closer.' },
      { stage: 'AI CEO #3 · Leifson Built', eta: '~14 days', what: 'Clone Young\'s creative + lead-gen stack. Add on-site proposal generator tied to Stripe Payment Link. Estimate-to-close automation.' },
      { stage: 'AI CEO #4 · Omni Leads (+ CPS tertiary)', eta: '~21 days', what: 'Lead routing engine for white-label clients. CPS layered as healthcare intake bot. At this point all 4 CEOs are shipping daily without manual intervention.' },
    ],
  };
}

export function buildExecDebriefHtml(d: ExecDebriefPayload): string {
  // Noon-UTC anchor + explicit PT timezone so the email header reads the
  // same calendar day regardless of reader locale (parsing 'YYYY-MM-DD'
  // alone gives midnight UTC = yesterday in PT).
  const dateLong = new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const kpis = kpiRow([
    { value: fmtMoney(d.portfolio_mrr), label: 'Portfolio MRR', color: THEME.green },
    { value: fmtMoney(d.portfolio_arr), label: 'ARR', color: THEME.cyan },
    { value: fmtMoney(d.cash_collected), label: 'Cash collected · last 90d', color: THEME.green },
    { value: `${d.paying_clients}/${d.total_clients}`, label: 'Paying clients' },
    { value: String(d.ships_30d), label: 'Ships · 30d', color: THEME.green },
  ]);

  const focus = callout(
    'Headline',
    `<strong style="color:${THEME.textPrimary};">${fmtMoney(d.portfolio_mrr)} MRR</strong> across ${d.paying_clients} paying clients. ${fmtMoney(d.cash_collected)} cash landed in PayPal over the last 90 days. ${d.commits_30d} commits and ${d.ships_30d} logged ships in 30 days — the infrastructure to run 4 AI CEOs is now standing.`,
    'green',
  );

  // Revenue table — HTML-escape client name + package since these
  // come from client_portfolio rows where the operator may have used
  // & < > " ' in display strings (Smith & Co, "QuickFix", etc).
  const esc = (s: string | null | undefined) =>
    (s ? String(s) : '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[m] as string);
  const revenueTable = dataTable(
    ['Client', 'Package', 'MRR', 'ARR'],
    d.paying.map((p) => ({
      cells: [
        { content: `${esc(p.emoji)} ${esc(p.name)}`, align: 'left' as const },
        { content: esc(p.package), align: 'left' as const, color: THEME.textMuted },
        { content: fmtMoney(p.mrr), align: 'right' as const, color: THEME.green },
        { content: fmtMoney(p.arr), align: 'right' as const, color: THEME.cyan },
      ],
    })),
  );

  // Ad results
  const adRows = d.ad_results
    .map(
      (a) => `
<tr><td style="padding:14px 0;border-bottom:1px solid ${THEME.border};">
  <div style="font-size:15px;font-weight:700;color:${THEME.textPrimary};margin-bottom:6px;">${a.client}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="25%" style="padding:6px 0;font-family:${THEME.fontMono};font-size:11px;color:${THEME.textSubtle};">REACH<br><span style="font-family:${THEME.fontBody};font-size:18px;color:${THEME.textPrimary};font-weight:700;">${a.reach}</span></td>
      <td width="25%" style="padding:6px 0;font-family:${THEME.fontMono};font-size:11px;color:${THEME.textSubtle};">LEADS<br><span style="font-family:${THEME.fontBody};font-size:18px;color:${THEME.green};font-weight:700;">${a.leads}</span></td>
      <td width="25%" style="padding:6px 0;font-family:${THEME.fontMono};font-size:11px;color:${THEME.textSubtle};">CPL<br><span style="font-family:${THEME.fontBody};font-size:18px;color:${THEME.green};font-weight:700;">$${a.cpl.toFixed(2)}</span></td>
      <td width="25%" style="padding:6px 0;font-family:${THEME.fontMono};font-size:11px;color:${THEME.textSubtle};">SPENT<br><span style="font-family:${THEME.fontBody};font-size:18px;color:${THEME.textPrimary};font-weight:700;">$${a.spent.toFixed(2)}</span></td>
    </tr>
  </table>
  <p style="margin:8px 0 0;font-size:13px;color:${THEME.textMuted};line-height:1.55;">${a.note}</p>
</td></tr>`,
    )
    .join('');
  const adCard = section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${adRows}</table>`);

  // What's been built — grouped list
  const builtInner = d.built
    .map(
      (g) => `
<div style="margin-bottom:18px;">
  <p style="margin:0 0 8px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${THEME.green};font-weight:700;">${g.category}</p>
  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.75;color:${THEME.text};">
    ${g.items.map((it) => `<li style="margin-bottom:4px;">${it}</li>`).join('')}
  </ul>
</div>`,
    )
    .join('');
  const builtCard = section(builtInner);

  // Roadmap — 4 AI CEOs
  const roadmapInner = d.roadmap
    .map(
      (r, i) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${i === d.roadmap.length - 1 ? '0' : '10px'};background:${THEME.surfaceRaised};border-left:3px solid ${THEME.green};border-radius:8px;">
  <tr><td style="padding:14px 18px;">
    <table role="presentation" width="100%"><tr>
      <td style="font-size:15px;font-weight:700;color:${THEME.textPrimary};">${r.stage}</td>
      <td align="right" style="font-family:${THEME.fontMono};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${THEME.green};white-space:nowrap;">${r.eta}</td>
    </tr></table>
    <p style="margin:6px 0 0;font-size:13px;line-height:1.65;color:${THEME.textMuted};">${r.what}</p>
  </td></tr>
</table>`,
    )
    .join('');
  const roadmapCard = section(roadmapInner);

  // Velocity summary
  const velocity = section(`
<p style="margin:0 0 10px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${THEME.textSubtle};">30-day velocity</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="33%" valign="top" style="padding:4px 6px 4px 0;">
      <div style="font-size:28px;font-weight:800;color:${THEME.green};">${d.commits_30d}</div>
      <div style="font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${THEME.textSubtle};margin-top:4px;">Git commits</div>
    </td>
    <td width="33%" valign="top" style="padding:4px 6px;">
      <div style="font-size:28px;font-weight:800;color:${THEME.green};">${d.newsletter_posts}</div>
      <div style="font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${THEME.textSubtle};margin-top:4px;">Newsletter posts</div>
    </td>
    <td width="33%" valign="top" style="padding:4px 0 4px 6px;">
      <div style="font-size:28px;font-weight:800;color:${THEME.green};">${d.landing_pages}</div>
      <div style="font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${THEME.textSubtle};margin-top:4px;">Landing pages</div>
    </td>
  </tr>
</table>
<p style="margin:14px 0 0;font-size:13px;line-height:1.65;color:${THEME.textMuted};">Average: ${Math.round(d.commits_30d / 30)} commits/day. ${(d.newsletter_posts / 30).toFixed(1)} newsletter posts/day. One new landing page/week. This velocity is why the 4 AI CEO timeline below is achievable.</p>`);

  const body = [
    header({
      eyebrow: '📊 Executive Debrief',
      title: 'Omni AI · CEO Status',
      meta: `${dateLong} · Prepared for Alfred Belvedere`,
      accent: 'green',
    }),
    kpis,
    focus,
    sectionHeading('Realised revenue · what\'s in the bank', 'green'),
    revenueTable,
    sectionHeading('Paid-ad performance · live', 'green'),
    adCard,
    sectionHeading('30-day build velocity', 'green'),
    velocity,
    sectionHeading('What\'s already built', 'green'),
    builtCard,
    sectionHeading('Path to all 4 AI CEOs running', 'green'),
    roadmapCard,
    ctaBlock({
      tagline: 'Ready to move? Book a 30-minute working session or read the Interlinked letter first.',
      primary: { href: 'https://omnileadsagi.com/interlinked/book-now', label: 'Book Now', accent: 'green' },
      secondary: { href: 'https://omnileadsagi.com/interlinked', label: 'Learn More' },
    }),
    footer({
      tagline: 'Omni AI · Executive Debrief',
      links: [
        { label: 'Command Center', href: 'https://omnileadsagi.com/command' },
        { label: 'Book a working session', href: 'https://omnileadsagi.com/book-now' },
      ],
    }),
  ].join('');

  return wrapper({
    title: `Omni AI Executive Debrief · ${dateLong}`,
    preheader: `${fmtMoney(d.portfolio_mrr)} MRR · ${fmtMoney(d.cash_collected)} cash collected · ${d.paying_clients}/${d.total_clients} paying · 4 AI CEOs on deck`,
    body,
  });
}

export async function sendExecDebrief(toEmail: string, commits30d: number): Promise<{ ok: boolean; payload: ExecDebriefPayload }> {
  const payload = await gatherExecDebrief(commits30d);
  const html = buildExecDebriefHtml(payload);
  let ok = false;
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Omni AI <bookings@omnileadsagi.com>',
          to: toEmail,
          subject: `Executive Debrief · ${fmtMoney(payload.portfolio_mrr)} MRR · ${payload.ships_30d} ships · 4 AI CEOs on deck`,
          html,
        }),
      });
      ok = r.ok;
      if (!ok) console.error('[exec-debrief] resend error', await r.text());
    }
  } catch (e) {
    console.error('[exec-debrief] send failed', e);
  }
  return { ok, payload };
}

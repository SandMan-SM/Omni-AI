import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram } from '@/lib/telegram';
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
  dot,
} from '@/lib/email-template';

// NOTE: email rendering rules are locked in docs/email-design-system.md.
// Do not inline layout HTML here — extend lib/email-template.ts instead.

export interface DailyBriefPayload {
  date: string;
  portfolio_arr_usd: number;
  portfolio_mrr_usd: number;
  biggest_mover?: { slug: string; name: string; delta_mrr_usd: number };
  ships_24h: number;
  reds: number;
  per_client: Array<{
    slug: string;
    name: string;
    emoji: string;
    mrr_usd: number;
    arr_usd: number;
    ships_24h: number;
    severity: string;
  }>;
  recent_ships: Array<{ client_slug: string | null; title: string; kind: string; created_at: string }>;
  focus: string;
}

/** Gather last-24h portfolio movement + produce a concise brief payload. */
export async function gatherDailyBrief(): Promise<DailyBriefPayload> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayAgoIso = new Date(Date.now() - 86400000).toISOString();

  const [{ data: clients }, { data: todayMetrics }, { data: yesterdayMetrics }, { data: recentShips }, { data: reds }] =
    await Promise.all([
      supabase.from('client_portfolio').select('slug, name, emoji, current_arr_usd, current_mrr_usd'),
      supabase.from('client_metrics_daily').select('client_slug, mrr_usd, arr_usd').eq('date', today),
      supabase.from('client_metrics_daily').select('client_slug, mrr_usd, arr_usd').eq('date', yesterday),
      supabase
        .from('build_log')
        .select('client_slug, title, kind, created_at')
        .gte('created_at', dayAgoIso)
        .order('created_at', { ascending: false }),
      supabase.from('client_risks').select('client_slug, title').is('resolved_at', null).eq('severity', 'red'),
    ]);

  const yMap: Record<string, number> = {};
  for (const m of yesterdayMetrics || []) yMap[m.client_slug] = m.mrr_usd || 0;
  const tMap: Record<string, number> = {};
  for (const m of todayMetrics || []) tMap[m.client_slug] = m.mrr_usd || 0;

  const ships24 = recentShips || [];
  const shipCountBySlug: Record<string, number> = {};
  for (const s of ships24) if (s.client_slug) shipCountBySlug[s.client_slug] = (shipCountBySlug[s.client_slug] || 0) + 1;

  const severityMap: Record<string, string> = {};
  for (const r of reds || []) if (r.client_slug) severityMap[r.client_slug] = 'red';

  const perClient = (clients || []).map((c: any) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji || '📦',
    mrr_usd: c.current_mrr_usd || 0,
    arr_usd: c.current_arr_usd || 0,
    ships_24h: shipCountBySlug[c.slug] || 0,
    severity: severityMap[c.slug] || 'green',
  }));

  // "Biggest mover" by magnitude — without abs() the comparison was
  // `delta > biggest.delta_mrr_usd`, which always picked the most-positive
  // delta. On a day where every client shrank, that surfaced the LEAST
  // bad drop and framed it as "today's biggest mover" — masking the real
  // story. The downstream UI already handles the +/- prefix to show
  // direction; what we want here is "the largest absolute change."
  let biggest: { slug: string; name: string; delta_mrr_usd: number } | undefined;
  for (const c of clients || []) {
    const delta = (tMap[c.slug] || 0) - (yMap[c.slug] || 0);
    if (!biggest || Math.abs(delta) > Math.abs(biggest.delta_mrr_usd)) {
      biggest = { slug: c.slug, name: c.name, delta_mrr_usd: delta };
    }
  }

  const portfolio_arr = perClient.reduce((s, c) => s + c.arr_usd, 0);
  const portfolio_mrr = perClient.reduce((s, c) => s + c.mrr_usd, 0);

  // Focus heuristic: pick the client with 0 ships in 24h AND highest ARR (best leverage to revive)
  const focusCandidate = [...perClient].filter((c) => c.ships_24h === 0).sort((a, b) => b.arr_usd - a.arr_usd)[0];
  const focus = focusCandidate
    ? `Today's focus: ${focusCandidate.emoji} ${focusCandidate.name} — no ships in 24h. Ship one thing there.`
    : `Every client shipped. Press the advantage.`;

  return {
    date: today,
    portfolio_arr_usd: portfolio_arr,
    portfolio_mrr_usd: portfolio_mrr,
    biggest_mover: biggest,
    ships_24h: ships24.length,
    reds: (reds || []).length,
    per_client: perClient,
    recent_ships: ships24.slice(0, 12),
    focus,
  };
}

export function buildDailyBriefHtml(b: DailyBriefPayload): string {
  // Anchor at noon UTC so the human date in the email header matches the
  // calendar day in any reader timezone. `new Date('2026-05-05')` parses
  // as 00:00 UTC, which is yesterday in PT — toLocaleDateString then
  // mislabels the brief by one day.
  const dateLong = new Date(b.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // 1. Top-line KPIs
  const kpis = kpiRow([
    { value: fmtMoney(b.portfolio_arr_usd), label: 'Portfolio ARR', color: THEME.green },
    { value: fmtMoney(b.portfolio_mrr_usd), label: 'MRR', color: THEME.cyan },
    { value: String(b.ships_24h), label: 'Ships · 24h', color: THEME.textPrimary },
    { value: String(b.reds), label: 'Red risks', color: b.reds > 0 ? THEME.red : THEME.green },
  ]);

  // 2. Biggest-mover line + today's focus callout
  const moverLine =
    b.biggest_mover && b.biggest_mover.delta_mrr_usd !== 0
      ? `<tr><td style="padding:0 2px 14px;font-size:14px;line-height:1.6;color:${THEME.text};">
          Biggest mover: <strong style="color:${THEME.green};">${escapeTxt(b.biggest_mover.name)}</strong>
          <span style="color:${THEME.textMuted};">
            ${b.biggest_mover.delta_mrr_usd >= 0 ? '+' : ''}${fmtMoney(b.biggest_mover.delta_mrr_usd)} MRR vs yesterday
          </span>
        </td></tr>`
      : '';

  const focusCallout = callout("Today's focus", `<strong style="color:${THEME.textPrimary};">${escapeTxt(b.focus)}</strong>`, 'amber');

  // 3. Portfolio table
  const portfolioRows = b.per_client
    .slice()
    .sort((x, y) => y.arr_usd - x.arr_usd)
    .map((c) => ({
      cells: [
        { content: `${c.emoji} ${escapeTxt(c.name)}`, align: 'left' as const },
        { content: fmtMoney(c.arr_usd), align: 'right' as const, color: THEME.green },
        { content: fmtMoney(c.mrr_usd), align: 'right' as const, color: THEME.cyan },
        { content: `${c.ships_24h}`, align: 'right' as const, color: THEME.textMuted },
        { content: dot(c.severity as 'red' | 'yellow' | 'green'), align: 'right' as const },
      ],
    }));
  const portfolioTable = dataTable(['Client', 'ARR', 'MRR', 'Ships 24h', 'State'], portfolioRows);

  // 4. Ship timeline
  const shipsInner = b.recent_ships.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${b.recent_ships
          .map((s) =>
            listRow({
              kind: s.kind,
              when: `${s.client_slug || '—'} · ${new Date(s.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' })}`,
              title: s.title,
            })
          )
          .join('')}
      </table>`
    : `<p style="margin:0;font-size:14px;color:${THEME.textMuted};">No ships logged in the last 24 hours.</p>`;

  const body = [
    header({ eyebrow: 'CEO Daily Brief', title: dateLong, meta: `Portfolio pulse across ${b.per_client.length} clients`, accent: 'green' }),
    kpis,
    moverLine,
    focusCallout,
    sectionHeading('Portfolio · ranked by ARR', 'green'),
    portfolioTable,
    sectionHeading('Ships · last 24 hours', 'green'),
    section(shipsInner, { padding: '6px 22px' }),
    ctaBlock({
      tagline: 'Every decision compounds. Open the Command Center and ship one more thing before EOD.',
      primary: { href: 'https://omnileadsagi.com/command', label: 'Open Command Center', accent: 'green' },
      secondary: { href: 'https://omnileadsagi.com/command/client/omni-ai', label: 'Omni AI detail' },
    }),
    footer({
      tagline: 'Omni AI · CEO Ops Suite',
      links: [
        { label: 'Command Center', href: 'https://omnileadsagi.com/command' },
        { label: 'Build Log', href: 'https://omnileadsagi.com/command#build-log' },
      ],
    }),
  ].join('');

  return wrapper({
    title: `CEO Daily Brief · ${dateLong}`,
    preheader: `${fmtMoney(b.portfolio_arr_usd)} ARR · ${b.ships_24h} ships · ${b.reds} reds · ${b.focus}`,
    body,
  });
}

function escapeTxt(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string);
}

export function buildTelegramBrief(b: DailyBriefPayload): string {
  const lines: string[] = [];
  lines.push(`📊 *CEO Brief — ${b.date}*`);
  lines.push('');
  lines.push(`Portfolio: *${fmtMoney(b.portfolio_arr_usd)}* ARR · *${fmtMoney(b.portfolio_mrr_usd)}* MRR`);
  lines.push(`${b.ships_24h} ships · ${b.reds} red risks`);
  if (b.biggest_mover && b.biggest_mover.delta_mrr_usd !== 0) {
    lines.push(`🚀 Mover: *${b.biggest_mover.name}* ${b.biggest_mover.delta_mrr_usd >= 0 ? '+' : ''}${fmtMoney(b.biggest_mover.delta_mrr_usd)}`);
  }
  lines.push('');
  lines.push(`🎯 ${b.focus}`);
  lines.push('');
  lines.push('https://omnileadsagi.com/command');
  return lines.join('\n');
}

export async function sendDailyBrief(toEmail = 'sitanim8@gmail.com'): Promise<{ emailed: boolean; telegrammed: boolean; payload: DailyBriefPayload }> {
  const payload = await gatherDailyBrief();
  const html = buildDailyBriefHtml(payload);
  const telegram = buildTelegramBrief(payload);

  let emailed = false;
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Omni AI <bookings@omnileadsagi.com>',
          to: toEmail,
          subject: `CEO Brief · ${payload.date} · ${fmtMoney(payload.portfolio_arr_usd)} ARR`,
          html,
        }),
      });
      emailed = res.ok;
    }
  } catch (e) {
    console.error('[daily-brief] email failed', e);
  }

  let telegrammed = false;
  try {
    telegrammed = await sendTelegram(telegram);
  } catch (e) {
    console.error('[daily-brief] telegram failed', e);
  }

  return { emailed, telegrammed, payload };
}

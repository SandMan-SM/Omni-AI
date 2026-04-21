import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram } from '@/lib/telegram';

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n}`;

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

  let biggest: { slug: string; name: string; delta_mrr_usd: number } | undefined;
  for (const c of clients || []) {
    const delta = (tMap[c.slug] || 0) - (yMap[c.slug] || 0);
    if (!biggest || delta > biggest.delta_mrr_usd) biggest = { slug: c.slug, name: c.name, delta_mrr_usd: delta };
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
  const date = new Date(b.date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const clientRows = b.per_client
    .sort((a, b) => b.arr_usd - a.arr_usd)
    .map(
      (c) => `
        <tr>
          <td style="padding:8px 4px;font-size:14px;">${c.emoji} ${c.name}</td>
          <td style="padding:8px 4px;font-size:14px;color:#10b981;text-align:right;">${fmtMoney(c.arr_usd)}</td>
          <td style="padding:8px 4px;font-size:14px;color:#06b6d4;text-align:right;">${fmtMoney(c.mrr_usd)}</td>
          <td style="padding:8px 4px;font-size:14px;text-align:right;color:#9ca3af;">${c.ships_24h} ship${c.ships_24h === 1 ? '' : 's'}</td>
          <td style="padding:8px 4px;font-size:14px;text-align:right;">${c.severity === 'red' ? '🔴' : c.severity === 'yellow' ? '🟡' : '🟢'}</td>
        </tr>`
    )
    .join('');

  const shipRows = b.recent_ships.length
    ? b.recent_ships
        .map(
          (s) => `
          <li style="margin-bottom:6px;font-size:13px;color:#d1d5db;">
            <span style="color:#10b981;font-family:monospace;font-size:11px;text-transform:uppercase;">${s.kind}</span>
            · ${s.client_slug || '—'} · ${s.title}
          </li>`
        )
        .join('')
    : '<li style="color:#6b7280;font-size:13px;">No ships in the last 24 hours.</li>';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>CEO Daily Brief — ${date}</title></head>
<body style="margin:0;background:#050508;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <p style="font-family:monospace;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#10b981;margin:0 0 4px;">CEO Daily Brief</p>
    <h1 style="font-size:26px;margin:0 0 24px;color:#fff;">${date}</h1>

    <div style="padding:20px;border-radius:12px;background:linear-gradient(135deg,rgba(16,185,129,.08),rgba(6,182,212,.04));border:1px solid rgba(16,185,129,.15);margin-bottom:20px;">
      <p style="font-size:13px;color:#9ca3af;margin:0 0 8px;">Portfolio position</p>
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <div><span style="font-size:28px;font-weight:700;color:#10b981;">${fmtMoney(b.portfolio_arr_usd)}</span><span style="font-size:12px;color:#6b7280;margin-left:6px;">ARR</span></div>
        <div><span style="font-size:28px;font-weight:700;color:#06b6d4;">${fmtMoney(b.portfolio_mrr_usd)}</span><span style="font-size:12px;color:#6b7280;margin-left:6px;">MRR</span></div>
        <div><span style="font-size:28px;font-weight:700;color:#fff;">${b.ships_24h}</span><span style="font-size:12px;color:#6b7280;margin-left:6px;">ships 24h</span></div>
        <div><span style="font-size:28px;font-weight:700;color:${b.reds > 0 ? '#ef4444' : '#10b981'};">${b.reds}</span><span style="font-size:12px;color:#6b7280;margin-left:6px;">red risks</span></div>
      </div>
    </div>

    ${
      b.biggest_mover && b.biggest_mover.delta_mrr_usd !== 0
        ? `<p style="font-size:14px;color:#d1d5db;margin:0 0 12px;">Biggest mover: <strong style="color:#10b981;">${b.biggest_mover.name}</strong> ${b.biggest_mover.delta_mrr_usd >= 0 ? '+' : ''}${fmtMoney(b.biggest_mover.delta_mrr_usd)} MRR.</p>`
        : ''
    }
    <p style="font-size:15px;color:#fde68a;margin:0 0 24px;padding:12px 16px;background:rgba(251,191,36,.08);border-left:3px solid #f59e0b;border-radius:6px;">${b.focus}</p>

    <h2 style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#10b981;margin:24px 0 8px;font-family:monospace;">Portfolio</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid rgba(255,255,255,.08);">
        <th style="text-align:left;padding:8px 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-family:monospace;">Client</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-family:monospace;">ARR</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-family:monospace;">MRR</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-family:monospace;">24h</th>
        <th style="text-align:right;padding:8px 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-family:monospace;">State</th>
      </tr></thead>
      <tbody>${clientRows}</tbody>
    </table>

    <h2 style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#10b981;margin:32px 0 8px;font-family:monospace;">Ships · last 24h</h2>
    <ul style="padding:0 0 0 18px;margin:0 0 24px;">${shipRows}</ul>

    <div style="text-align:center;padding:20px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:24px;">
      <a href="https://omnileadsagi.com/command" style="display:inline-block;padding:10px 20px;background:linear-gradient(90deg,#10b981,#06b6d4);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Command Center →</a>
    </div>
    <p style="text-align:center;font-size:11px;color:#6b7280;margin:12px 0 0;font-family:monospace;">OMNI AI · CEO OPS SUITE</p>
  </div>
</body></html>`;
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

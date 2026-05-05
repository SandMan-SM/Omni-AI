import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegram } from '@/lib/agi/telegram';
import { ptStartOfDayIso } from '@/lib/tz';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Telegram bot webhook for 2-way commands.
// Setup:
//   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://omnileadsagi.com/api/telegram/webhook"
//
// Supported commands (just send to your bot):
//   /digest     — get today's digest as a Telegram message
//   /run        — trigger autopilot for default business
//   /credits    — Apollo credit usage
//   /pipeline   — quick pipeline numbers
//   /help       — list commands
export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const message = update.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Auth: only respond to configured chat
    if (process.env.TELEGRAM_CHAT_ID && chatId !== process.env.TELEGRAM_CHAT_ID) {
      await sendTelegram('🚫 Not authorized.', chatId);
      return NextResponse.json({ ok: true });
    }

    // Pull the default (first) business for now
    const { data: businesses } = await supabase
      .from('omni_businesses').select('*').order('name').limit(1);
    const business = businesses?.[0];

    if (!business) {
      await sendTelegram('⚠️ No business found.', chatId);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/help')) {
      await sendTelegram(
        `*OmniLeads AGI Bot*\n\n` +
        `/focus — today's focus across all businesses\n` +
        `/digest — daily KPI digest\n` +
        `/hot — fire pending hot-lead alerts\n` +
        `/pipeline — pipeline summary\n` +
        `/businesses — advancement scores per tenant\n` +
        `/score — bulk re-score the default business\n` +
        `/credits — Apollo credit usage\n` +
        `/run — trigger autopilot\n` +
        `/help — this menu`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    const baseUrl = req.url.replace(/\/api\/agi\/telegram\/webhook.*/, '').replace(/\/api\/telegram\/webhook.*/, '');

    // Forward CRON_SECRET on every internal fetch so auth-gated routes
    // (bulk-score, hot-lead-alerts, autopilot/run, etc.) accept this
    // webhook's calls. The webhook itself is authenticated via chat-id
    // match above; this re-uses the cron path's auth surface.
    const internalAuth: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.CRON_SECRET) internalAuth.Authorization = `Bearer ${process.env.CRON_SECRET}`;

    if (text.startsWith('/focus')) {
      const r = await fetch(`${baseUrl}/api/agi/focus`, { cache: 'no-store' });
      const f = await r.json();
      const lines: string[] = [`✨ *Today's Focus*\n`];
      if ((f.hot_new_leads ?? []).length) {
        lines.push(`🔥 *${f.hot_new_leads.length} hot new leads* — first contact needed`);
        for (const l of f.hot_new_leads.slice(0, 3)) {
          const name = [l.first_name, l.last_name].filter(Boolean).join(' ') || l.email;
          lines.push(`  • ${name} (${l.score}) @ ${l.business_name ?? '?'}`);
        }
      }
      if ((f.today_meetings ?? []).length) {
        lines.push(`\n📅 *${f.today_meetings.length} meetings today*`);
        for (const m of f.today_meetings.slice(0, 3)) {
          const t = new Date(m.start_at).toLocaleTimeString('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric', minute: '2-digit',
          });
          lines.push(`  • ${t} · ${m.attendee_name}`);
        }
      }
      if ((f.stuck_leads ?? []).length) {
        lines.push(`\n⏰ *${f.stuck_leads.length} stuck leads* — idle 14+ days`);
      }
      if ((f.recent_conversions ?? []).length) {
        lines.push(`\n🎉 *${f.recent_conversions.length} conversions* in last 24h`);
      }
      if (lines.length === 1) lines.push(`All caught up — no urgent items.`);
      await sendTelegram(lines.join('\n'), chatId);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/hot')) {
      const r = await fetch(`${baseUrl}/api/agi/leads/hot-lead-alerts`, {
        method: 'POST', headers: internalAuth,
      });
      const j = await r.json();
      await sendTelegram(
        j.ok
          ? `🔥 Scanned ${j.scanned ?? 0} · already alerted ${j.already_alerted ?? 0} · *${j.alerted ?? 0} new alerts fired*`
          : `🚨 Hot-lead scan failed: ${j.error}`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/businesses')) {
      const r = await fetch(`${baseUrl}/api/agi/businesses/advancement`, { cache: 'no-store' });
      const j = await r.json();
      const list = (j.businesses ?? []).slice(0, 8);
      const lines: string[] = ['🏢 *Business Advancement*\n'];
      for (const b of list) {
        const arrow = b.advancement_score >= 70 ? '🟢' : b.advancement_score >= 30 ? '🟡' : '⚫️';
        lines.push(`${arrow} *${b.business_name}* — score ${b.advancement_score}, ${b.leads_total} leads, ${b.leads_converted} won`);
      }
      await sendTelegram(lines.join('\n'), chatId);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/score')) {
      await sendTelegram(`🧠 Re-scoring all leads for ${business.name}…`, chatId);
      const r = await fetch(`${baseUrl}/api/agi/leads/bulk-score`, {
        method: 'POST', headers: internalAuth,
        body: JSON.stringify({ business_id: business.id }),
      });
      const j = await r.json();
      await sendTelegram(
        j.error
          ? `🚨 Bulk score failed: ${j.error}`
          : `✓ Scored ${j.scored ?? '?'} leads · ${j.errors ?? 0} errors`,
        chatId
      );
      // Chain hot-lead alerts (auth-forwarded).
      await fetch(`${baseUrl}/api/agi/leads/hot-lead-alerts`, {
        method: 'POST', headers: internalAuth,
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/digest')) {
      // Anchor "today" on the operator's PT calendar day. The previous
      // computation used UTC midnight, so an early-morning telegram poll
      // showed yesterday-evening counts under "today".
      const startISO = ptStartOfDayIso();
      const [{ count: leads }, { count: sent }, { count: replies }, { count: bookings }] = await Promise.all([
        supabase.from('omni_leads_generated').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', startISO),
        supabase.from('omni_outreach_assets').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('sent_at', startISO),
        supabase.from('omni_outreach_assets').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('replied_at', startISO),
        supabase.from('omni_meeting_bookings').select('*', { count: 'exact', head: true }).eq('business_id', business.id).gte('created_at', startISO),
      ]);
      await sendTelegram(
        `📊 *Today @ ${business.name}*\n\n` +
        `🆕 Leads: ${leads ?? 0}\n` +
        `📤 Sent: ${sent ?? 0}\n` +
        `💬 Replies: ${replies ?? 0}\n` +
        `📅 Booked: ${bookings ?? 0}`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/credits')) {
      const month = new Date().toISOString().slice(0, 7);
      const { data: credits } = await supabase
        .from('omni_apollo_credits').select('credits_used, credits_limit')
        .eq('business_id', business.id).eq('month', month).maybeSingle();
      const used = credits?.credits_used ?? 0;
      const limit = credits?.credits_limit ?? 95;
      await sendTelegram(
        `⚡ *Apollo Credits — ${business.name}*\n\n` +
        `Used: ${used} / ${limit}\nRemaining: ${limit - used}`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/pipeline')) {
      const { data: leads } = await supabase
        .from('omni_leads_generated').select('deal_stage, deal_value, status')
        .eq('business_id', business.id);
      const arr = leads ?? [];
      const won = arr.filter(l => l.deal_stage === 'closed_won');
      // Match the dashboard's open-pipeline definition: exclude both
      // deal_stage closed_lost AND lead-level status='lost'.
      const open = arr.filter(l =>
        !['closed_won', 'closed_lost'].includes(l.deal_stage ?? '') &&
        l.status !== 'lost',
      );
      const wonRevenue = won.reduce((s, l) => s + (l.deal_value ?? 0), 0);
      await sendTelegram(
        `📈 *Pipeline @ ${business.name}*\n\n` +
        `Total leads: ${arr.length}\n` +
        `Open: ${open.length}\n` +
        `Won: ${won.length} ($${(wonRevenue / 100).toFixed(0)})\n` +
        `Qualified: ${arr.filter(l => l.status === 'qualified').length}`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/run')) {
      // Both base regex and target path were wrong — this route is mounted
      // at /api/agi/telegram/webhook and the autopilot endpoint at
      // /api/agi/autopilot/run. With the old paths the fetch hit a 404
      // and the bot replied "Autopilot failed: undefined" without ever
      // running the autopilot.
      const baseUrl = req.url.replace(/\/api\/agi\/telegram\/webhook.*/, '');
      const r = await fetch(`${baseUrl}/api/agi/autopilot/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      });
      const j = await r.json();
      await sendTelegram(
        j.ok
          ? `🤖 *Autopilot run complete*\n\n✓ ${j.succeeded} succeeded\n⏭ ${j.skipped} skipped\n✗ ${j.failed} failed`
          : `🤖 Autopilot failed: ${j.error}`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    // Default: not a command
    await sendTelegram(`Unknown command. Try /help.`, chatId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[telegram/webhook]', err);
    return NextResponse.json({ ok: true }); // Always 200 so Telegram doesn't retry
  }
}

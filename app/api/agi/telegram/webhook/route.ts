import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegram } from '@/lib/agi/telegram';

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
        `/digest — today's stats\n` +
        `/credits — Apollo credit usage\n` +
        `/pipeline — pipeline summary\n` +
        `/run — trigger autopilot\n` +
        `/help — this menu`,
        chatId
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/digest')) {
      const today = new Date().toISOString().slice(0, 10);
      const startISO = new Date(today).toISOString();
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
      const open = arr.filter(l => !['closed_won', 'closed_lost'].includes(l.deal_stage ?? ''));
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
      const baseUrl = req.url.replace(/\/api\/telegram\/webhook.*/, '');
      const r = await fetch(`${baseUrl}/api/autopilot/run`, {
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

import { NextRequest, NextResponse } from 'next/server';
import { sendTelegram } from '@/lib/agi/telegram';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

// Generic Telegram notification dispatcher.
// Auth-gated — without this an unauthenticated POST to /api/agi/notifications/telegram
// could spam the operator's chat (default chat_id = env TELEGRAM_CHAT_ID) with
// arbitrary attacker-supplied text. Accepts either CRON_SECRET (for ops automation)
// or an admin session.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { text, parse_mode, chat_id } = await req.json() as {
      text: string;
      parse_mode?: 'Markdown' | 'HTML';
      chat_id?: string;
    };
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

    const result = await sendTelegram({ text, parse_mode }, chat_id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notifications/telegram]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

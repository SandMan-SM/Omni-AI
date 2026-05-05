// Telegram notifications. Uses raw Bot API — no SDK needed.
// Setup:
//   1. Talk to @BotFather on Telegram → /newbot → get TELEGRAM_BOT_TOKEN
//   2. Send the bot a message, then visit:
//      https://api.telegram.org/bot<TOKEN>/getUpdates
//      to find your chat_id
//   3. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local

export type TelegramMessage = {
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
};

export async function sendTelegram(msg: TelegramMessage | string, override_chat_id?: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = override_chat_id ?? process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    text: typeof msg === 'string' ? msg : msg.text,
  };

  if (typeof msg === 'object') {
    if (msg.parse_mode) payload.parse_mode = msg.parse_mode;
    if (msg.disable_web_page_preview !== undefined) payload.disable_web_page_preview = msg.disable_web_page_preview;
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: `Telegram API ${resp.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

// Helper for common notifications
export async function notifyReply(args: {
  leadName: string;
  company: string | null;
  category: string | null;
  snippet: string;
}) {
  const emoji = {
    interested: '🎯',
    meeting_booked: '📅',
    question: '❓',
    not_now: '⏰',
    unsubscribe: '🚫',
  }[args.category ?? 'other'] ?? '💬';

  const text = `${emoji} *Lead Replied!*\n\n*${args.leadName}*${args.company ? ` @ ${args.company}` : ''}\nCategory: \`${args.category ?? 'unknown'}\`\n\n_${args.snippet.slice(0, 200)}_`;
  return sendTelegram(text);
}

export async function notifyBooking(args: {
  attendeeName: string;
  attendeeEmail: string;
  start_at: string;
}) {
  // Format in PT — without an explicit timeZone, toLocaleString uses
  // server-local (UTC on Vercel) so a booking at 1500 UTC was rendering
  // as "3:00 PM GMT" in the operator's Telegram instead of "8:00 AM PDT".
  const dt = new Date(args.start_at).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const text = `📅 *New Meeting Booked!*\n\n*${args.attendeeName}*\n${args.attendeeEmail}\n\n🕐 ${dt}`;
  return sendTelegram(text);
}

export async function notifyHotLead(args: {
  leadName: string;
  company: string | null;
  score: number;
  reason: string;
}) {
  const text = `🔥 *Hot Lead Surfaced!*\n\n*${args.leadName}* @ ${args.company ?? '?'}\nScore: *${args.score}/100*\n\n${args.reason}`;
  return sendTelegram(text);
}

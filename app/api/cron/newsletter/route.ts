import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDailyNewsletter } from '@/lib/newsletter-sender';

// Called by Vercel Cron at 8:00 AM ET daily
// Secured by CRON_SECRET env var
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const result = await runDailyNewsletter(supabase as any);

    console.log(
      `[Newsletter Cron] Sent: ${result.content.subject} | ` +
      `Telegram: ${result.telegramOk} | Email: ${result.emailOk} | Premium: ${result.premiumSent}`
    );

    return NextResponse.json({
      success: true,
      subject: result.content.subject,
      telegram: result.telegramOk,
      email: result.emailOk,
      premium_recipients: result.premiumSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Newsletter Cron] Failed:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

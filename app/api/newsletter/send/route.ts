import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDailyNewsletter } from '@/lib/newsletter-sender';

export async function POST() {
  try {
    const supabase = await createClient();
    const result = await runDailyNewsletter(supabase as any);

    return NextResponse.json({
      message: 'Newsletter sent',
      subject: result.content.subject,
      telegram: result.telegramOk,
      email: result.emailOk,
      premium_recipients: result.premiumSent,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Newsletter send error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

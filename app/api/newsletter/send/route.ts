import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDailyNewsletter, runPremiumNewsletter } from '@/lib/newsletter-sender';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check if a specific tier was requested
    let tier = 'free';
    try {
      const body = await request.json();
      tier = body.tier || 'free';
    } catch {
      // No body = default free tier
    }

    if (tier === 'premium') {
      const result = await runPremiumNewsletter(supabase as any);
      return NextResponse.json({
        message: result.skipped ? 'Premium skipped' : 'Premium newsletter sent',
        ...(!result.skipped && {
          subject: result.content?.subject,
          day_type: result.content?.day_type,
          telegram: result.telegramOk,
          premium_recipients: result.premiumSent,
        }),
        ...(result.skipped && { reason: result.reason }),
      });
    }

    const result = await runDailyNewsletter(supabase as any);

    return NextResponse.json({
      message: 'Free newsletter sent',
      subject: result.content.subject,
      slug: result.content.slug,
      telegram: result.telegramOk,
      email: result.emailOk,
      free_recipients: result.freeSent,
      keywords: result.content.keywords?.slice(0, 5),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Newsletter send error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

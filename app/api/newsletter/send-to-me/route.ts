import { NextResponse } from 'next/server';
import {
  generateFreeContent,
  generatePremiumContent,
  sendEmail,
} from '@/lib/newsletter-sender';
import { constantTimeEqual } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * On-demand preview sender — generates fresh FREE + PREMIUM content
 * and emails both to the requested address. Secret-gated.
 *
 * Usage:
 *   GET /api/newsletter/send-to-me?secret=XXX&to=alfred@omnileadsagi.com
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const to = searchParams.get('to') || process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';

  if (
    !process.env.CRON_SECRET ||
    !secret ||
    !constantTimeEqual(secret, process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [freeContent, premiumContent] = await Promise.all([
      generateFreeContent(),
      generatePremiumContent(),
    ]);

    const [freeOk, premiumOk] = await Promise.all([
      sendEmail(freeContent, to),
      sendEmail(premiumContent, to),
    ]);

    return NextResponse.json({
      success: true,
      to,
      free: { subject: freeContent.subject, sent: freeOk },
      premium: { subject: premiumContent.subject, sent: premiumOk },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

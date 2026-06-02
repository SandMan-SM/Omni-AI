import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDailyNewsletter, runPremiumNewsletter } from '@/lib/newsletter-sender';
import { requireAdmin } from '@/lib/admin-auth';

// Force-dynamic ensures this route is never prerendered. POST handlers
// aren't cached by default, but the explicit declaration documents
// intent for any future migration to edge / ISR.
export const dynamic = 'force-dynamic';

/**
 * POST /api/newsletter/send
 *
 * Triggers a full newsletter send (free or premium tier) to every
 * subscriber. Previously completely unauthenticated — any anonymous
 * request would fire a real Resend campaign to the entire list.
 *
 * Now admin-gated via requireAdmin() which accepts either a Supabase
 * cookie session OR the localStorage omni_token forwarded in the
 * Authorization header. Both auth paths already exist on other admin
 * routes (newsletter/subscribers, admin/users, etc.) so this brings
 * parity without changing the client-side call sites: the admin studio
 * fetches from /admin which is cookie-gated by middleware, so cookies
 * are always present at send time.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

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
    console.error('Newsletter send error:', error);
    return NextResponse.json(
      {
        error: 'Newsletter send is temporarily unavailable.',
        reason: 'send_failed',
      },
      { status: 500 },
    );
  }
}

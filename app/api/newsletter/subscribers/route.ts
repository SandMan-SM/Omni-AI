import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Newsletter-subscribers endpoint.
 *
 * - GET is admin-only. Previously this read via the user-scoped client and
 *   relied on RLS returning zero rows for anonymous callers. That's a brittle
 *   defense — any future RLS relaxation would turn this into an
 *   enumeration surface. `requireAdmin()` is explicit defense-in-depth.
 * - POST stays unauthed so the public subscribe form works, but we:
 *   - validate the email,
 *   - clamp subscription_tier to 'subscribed' (prevent self-promotion to 'premium'),
 *   - upsert on email so a re-signup cleanly reactivates an unsubscribed row.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('id, email, first_name, subscription_tier, subscribed, subscribed_at, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ subscribers: data || [], total: (data || []).length });
  } catch (error) {
    console.error('[newsletter/subscribers] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const firstNameRaw = typeof body?.first_name === 'string'
      ? body.first_name.trim().slice(0, 120)
      : null;

    if (!emailRaw) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!EMAIL_RE.test(emailRaw)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Always start on the free tier — never trust a client-supplied tier.
    // Admin users who need to grant premium can use /api/admin/newsletter/*.
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .upsert(
        {
          email: emailRaw,
          first_name: firstNameRaw,
          subscription_tier: 'subscribed',
          subscribed: true,
        },
        { onConflict: 'email' },
      )
      .select('id, email, first_name, subscription_tier, subscribed, created_at')
      .single();

    if (error) {
      console.error('[newsletter/subscribers] POST insert error:', error);
      return NextResponse.json({ error: "Couldn't add that subscriber." }, { status: 400 });
    }
    return NextResponse.json({ subscriber: data }, { status: 201 });
  } catch (error) {
    console.error('[newsletter/subscribers] POST error:', error);
    return NextResponse.json({ error: 'Failed to add subscriber' }, { status: 500 });
  }
}

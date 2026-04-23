import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Aggregate subscriber-count stats — admin-only.
 *
 * Previously this read via `createAdminClient()` (service-role, RLS-bypassed)
 * with zero auth, meaning any anonymous caller could enumerate global
 * subscriber counts (total/active/premium/free). That's a meaningful
 * business-metrics leak. `requireAdmin()` closes it.
 *
 * The admin panel (newsletter-studio) already forwards the omni_token
 * bearer on this fetch, so no client-side change is needed here.
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('subscribed, subscription_tier');

    if (error) throw error;

    const all = data || [];
    return NextResponse.json({
      total: all.length,
      active: all.filter(s => s.subscribed !== false).length,
      premium: all.filter(s => s.subscription_tier === 'premium').length,
      free: all.filter(s => s.subscription_tier !== 'premium').length,
      unsubscribed: all.filter(s => s.subscribed === false).length,
    });
  } catch (error) {
    console.error('[newsletter/stats] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

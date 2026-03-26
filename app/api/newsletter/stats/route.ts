import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
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
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

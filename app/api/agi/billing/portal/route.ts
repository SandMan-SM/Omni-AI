import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/agi/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Create a Stripe Customer Portal session for self-service billing
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

    const { business_id } = await req.json();
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    const { data: business } = await supabase
      .from('omni_businesses').select('stripe_customer_id').eq('id', business_id).single();
    if (!(business as { stripe_customer_id?: string })?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer for this business yet' }, { status: 400 });
    }

    const origin = req.headers.get('origin') ?? (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'http://localhost:3002');
    const portal = await stripe.billingPortal.sessions.create({
      customer: (business as { stripe_customer_id: string }).stripe_customer_id,
      return_url: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err) {
    console.error('[billing/portal]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

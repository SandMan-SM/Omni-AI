import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/agi/stripe';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST: create a Stripe Checkout session for a plan
export async function POST(req: NextRequest) {
  // Auth-gate. POST mints a Stripe checkout session bound to the
  // tenant's customer record. Worse: if no stripe_customer_id
  // exists, it CREATES one against the tenant's contact_email and
  // stamps it back on the row. Without auth, an attacker can pin
  // the wrong Stripe customer to any tenant.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({
        error: 'STRIPE_SECRET_KEY not set. Add to .env.local to enable billing.',
      }, { status: 503 });
    }

    const { business_id, plan_tier, billing_cycle } = await req.json() as {
      business_id: string;
      plan_tier: 'starter' | 'pro' | 'enterprise';
      billing_cycle: 'monthly' | 'yearly';
    };

    if (!business_id || !plan_tier) {
      return NextResponse.json({ error: 'business_id and plan_tier required' }, { status: 400 });
    }

    const { data: plan } = await supabase
      .from('omni_plans').select('*').eq('tier', plan_tier).single();
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const priceId = billing_cycle === 'yearly' ? plan.stripe_yearly_price_id : plan.stripe_monthly_price_id;
    if (!priceId) {
      return NextResponse.json({
        error: `${billing_cycle} price not configured for ${plan.name}. Set stripe_${billing_cycle}_price_id in omni_plans.`,
      }, { status: 503 });
    }

    const { data: business } = await supabase
      .from('omni_businesses').select('*').eq('id', business_id).single();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    // Create or reuse Stripe customer
    let customerId = (business as { stripe_customer_id?: string }).stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (business as { contact_email?: string }).contact_email ?? undefined,
        name: business.name,
        metadata: { business_id },
      });
      customerId = customer.id;
      await supabase.from('omni_businesses').update({ stripe_customer_id: customerId }).eq('id', business_id);
    }

    const origin = req.headers.get('origin') ?? (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'http://localhost:3002');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?success=1`,
      cancel_url: `${origin}/pricing`,
      metadata: { business_id, plan_tier, billing_cycle },
      subscription_data: { metadata: { business_id, plan_tier } },
    });

    return NextResponse.json({ ok: true, url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[billing/checkout]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

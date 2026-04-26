import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/agi/stripe';
import type Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Stripe webhook handler. Configure in Stripe dashboard:
//   Endpoint: https://omnileadsagi.com/api/billing/webhook
//   Events: customer.subscription.* + invoice.* + checkout.session.completed
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('[billing/webhook] sig verify failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId = session.metadata?.business_id;
        if (businessId && session.subscription) {
          await supabase.from('omni_businesses').update({
            stripe_subscription_id: session.subscription as string,
            subscription_status: 'active',
            plan: session.metadata?.plan_tier ?? 'pro',
          }).eq('id', businessId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.business_id;
        if (businessId) {
          const renewalAt = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
          await supabase.from('omni_businesses').update({
            stripe_subscription_id: sub.id,
            subscription_status: sub.status as 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing',
            subscription_renewal_at: renewalAt ? new Date(renewalAt * 1000).toISOString() : null,
            plan: sub.metadata?.plan_tier ?? undefined,
          }).eq('id', businessId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.business_id;
        if (businessId) {
          await supabase.from('omni_businesses').update({
            subscription_status: 'canceled',
          }).eq('id', businessId);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
        if (invoice.subscription) {
          await supabase.from('omni_businesses').update({
            subscription_status: 'past_due',
          }).eq('stripe_subscription_id', invoice.subscription);
        }
        break;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[billing/webhook]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

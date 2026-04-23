import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const sb = createAdminClient();

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Log the raw error server-side only; the webhook response goes back
    // to Stripe (not an end user), but there's still no reason to return
    // the raw Postgres/JS error text. Stripe only needs a non-2xx to
    // schedule a retry.
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const email = session.customer_email || session.customer_details?.email;
  if (!email) return;

  // Find profile by email
  const { data: profile } = await sb
    .from('profiles')
    .select('id, name, email')
    .eq('email', email)
    .single();

  const profileId = profile?.id || null;
  const amount = (session.amount_total || 0) / 100;

  // Create transaction
  await sb.from('transactions').insert({
    profile_id: profileId,
    stripe_payment_intent_id: session.payment_intent as string,
    amount,
    currency: session.currency || 'usd',
    type: session.mode === 'subscription' ? 'subscription' : 'one_time',
    status: 'completed',
    product_type: session.mode === 'subscription' ? 'premium_newsletter' : 'merch',
    paid_at: new Date().toISOString(),
  });

  // Update profile revenue
  if (profileId) {
    const { data: current } = await sb
      .from('profiles')
      .select('gross_revenue, total_spent, purchase_count')
      .eq('id', profileId)
      .single();

    if (current) {
      await sb.from('profiles').update({
        gross_revenue: (parseFloat(current.gross_revenue) || 0) + amount,
        total_spent: (parseFloat(current.total_spent) || 0) + amount,
        purchase_count: (current.purchase_count || 0) + 1,
        last_purchase_at: new Date().toISOString(),
      }).eq('id', profileId);
    }

    // If subscription, mark as premium
    if (session.mode === 'subscription') {
      await sb.from('profiles').update({
        is_premium: true,
        subscription_status: 'active',
        premium_since: new Date().toISOString(),
        stripe_customer_id: session.customer as string,
      }).eq('id', profileId);

      // Also update newsletter_subscriptions
      await sb.from('newsletter_subscriptions').upsert({
        email,
        subscription_tier: 'premium',
        subscribed: true,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      }, { onConflict: 'email' });
    }
  }

  // Log event
  logEvent(sb, {
    actor_type: 'webhook',
    actor_id: 'stripe',
    event_type: 'payment_received',
    event_category: 'revenue',
    action: 'create',
    target_type: 'profile',
    target_id: profileId || undefined,
    value_numeric: amount,
    value_text: session.mode || 'one_time',
    properties: {
      email,
      stripe_session_id: session.id,
      payment_intent: session.payment_intent,
    },
  });

  console.log(`[Stripe] Checkout complete: ${email}, $${amount}, mode=${session.mode}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const email = invoice.customer_email;
  if (!email) return;

  const amount = (invoice.amount_paid || 0) / 100;

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  const profileId = profile?.id || null;

  // Create transaction for recurring payment
  await sb.from('transactions').insert({
    profile_id: profileId,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: (invoice as any).subscription as string,
    amount,
    currency: invoice.currency || 'usd',
    type: 'subscription',
    status: 'completed',
    product_type: 'premium_newsletter',
    paid_at: new Date().toISOString(),
  });

  // Update profile revenue
  if (profileId) {
    const { data: current } = await sb
      .from('profiles')
      .select('gross_revenue, total_spent, purchase_count')
      .eq('id', profileId)
      .single();

    if (current) {
      await sb.from('profiles').update({
        gross_revenue: (parseFloat(current.gross_revenue) || 0) + amount,
        total_spent: (parseFloat(current.total_spent) || 0) + amount,
        purchase_count: (current.purchase_count || 0) + 1,
        last_purchase_at: new Date().toISOString(),
      }).eq('id', profileId);
    }
  }

  logEvent(sb, {
    actor_type: 'webhook',
    actor_id: 'stripe',
    event_type: 'payment_received',
    event_category: 'revenue',
    action: 'create',
    target_type: 'profile',
    target_id: profileId || undefined,
    value_numeric: amount,
    value_text: 'subscription_renewal',
    properties: { email, invoice_id: invoice.id },
  });

  console.log(`[Stripe] Invoice paid: ${email}, $${amount}`);
}

async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  const customerId = sub.customer as string;

  // Find profile by stripe_customer_id
  const { data: profile } = await sb
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await sb.from('profiles').update({
      is_premium: true,
      subscription_status: 'active',
      premium_since: new Date().toISOString(),
    }).eq('id', profile.id);

    logEvent(sb, {
      actor_type: 'webhook',
      actor_id: 'stripe',
      event_type: 'subscription_started',
      event_category: 'revenue',
      action: 'create',
      target_type: 'profile',
      target_id: profile.id,
      value_text: sub.id,
    });
  }

  console.log(`[Stripe] Subscription created: ${customerId}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = sub.customer as string;

  const { data: profile } = await sb
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await sb.from('profiles').update({
      is_premium: false,
      subscription_status: 'cancelled',
    }).eq('id', profile.id);

    // Downgrade in newsletter_subscriptions
    if (profile.email) {
      await sb.from('newsletter_subscriptions')
        .update({ subscription_tier: 'subscribed' })
        .eq('email', profile.email);
    }

    logEvent(sb, {
      actor_type: 'webhook',
      actor_id: 'stripe',
      event_type: 'subscription_cancelled',
      event_category: 'revenue',
      action: 'delete',
      target_type: 'profile',
      target_id: profile.id,
      value_text: sub.id,
    });
  }

  console.log(`[Stripe] Subscription deleted: ${customerId}`);
}

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
  } catch (err: unknown) {
    // Narrow `unknown` for type-safe .message access. The response
    // already returns a generic 'Invalid signature' — only the server
    // log keeps the raw Stripe text for triage.
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Stripe Webhook] Signature verification failed:', msg);
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

      case 'invoice.payment_failed': {
        // Subscription payment failed (card declined, insufficient funds,
        // etc.). Stripe will retry per its Smart Retries schedule, but
        // the profile needs to know it's in a grace period NOW so the
        // app can surface "Update your payment method" prompts.
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(sub);
        break;
      }

      case 'customer.subscription.updated': {
        // Fires on plan changes, pause/resume, and
        // `cancel_at_period_end` flips (user clicked Cancel but still
        // paid through the current period). Without this we'd keep
        // is_premium=true forever on users who cancelled because we
        // only listen to `subscription.deleted` which fires at
        // period-end, not at cancellation time.
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      case 'charge.refunded': {
        // Full or partial refund on a charge. Without this, Stripe
        // refunds leave the transaction row marked 'completed' and the
        // profile's gross_revenue / total_spent drift out of sync with
        // actual money in the bank.
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
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

  // Idempotency check — Stripe retries webhooks up to 3 days. If we
  // already booked this payment_intent, bail before touching the
  // transactions table. Previously a single retried webhook would
  // double-count revenue AND double-bump purchase_count on the profile,
  // so production numbers drifted a few % high over time.
  const paymentIntentId = session.payment_intent as string | null;
  if (paymentIntentId) {
    const { data: existingTx } = await sb
      .from('transactions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();
    if (existingTx) {
      console.log(`[Stripe] Duplicate checkout webhook for ${paymentIntentId}; skipping.`);
      return;
    }
  }

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
    stripe_payment_intent_id: paymentIntentId,
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

  // Idempotency check — see handleCheckoutComplete. For invoice.paid
  // the dedupe key is stripe_invoice_id (payment_intent on an invoice
  // is not guaranteed unique across retries).
  if (invoice.id) {
    const { data: existingTx } = await sb
      .from('transactions')
      .select('id')
      .eq('stripe_invoice_id', invoice.id)
      .maybeSingle();
    if (existingTx) {
      console.log(`[Stripe] Duplicate invoice.paid webhook for ${invoice.id}; skipping.`);
      return;
    }
  }

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

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // A subscription invoice failed to collect. Stripe will retry per
  // Smart Retries, but the profile should reflect "past_due" NOW so
  // downstream logic (paywalls, banners, churn outreach) can react.
  const email = invoice.customer_email;
  const subscriptionId = (invoice as any).subscription as string | undefined;
  if (!email && !subscriptionId) return;

  // Prefer looking up by stripe_subscription_id since email on an
  // invoice can be null during network-level retries.
  let profileId: string | null = null;
  if (subscriptionId) {
    const { data } = await sb
      .from('newsletter_subscriptions')
      .select('email')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (data?.email) {
      const { data: p } = await sb
        .from('profiles')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();
      profileId = p?.id || null;
    }
  }
  if (!profileId && email) {
    const { data } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    profileId = data?.id || null;
  }

  if (profileId) {
    await sb
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('id', profileId);
  }

  logEvent(sb, {
    actor_type: 'webhook',
    actor_id: 'stripe',
    event_type: 'payment_failed',
    event_category: 'revenue',
    action: 'update',
    target_type: 'profile',
    target_id: profileId || undefined,
    value_numeric: (invoice.amount_due || 0) / 100,
    value_text: 'invoice_payment_failed',
    properties: {
      email: email || null,
      invoice_id: invoice.id,
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt,
    },
  });

  console.log(`[Stripe] Payment failed: ${email || subscriptionId}, attempt=${invoice.attempt_count}`);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  // Plan changes, pause/resume, `cancel_at_period_end` flips. We mirror
  // Stripe's status onto the profile so the rest of the app (paywall
  // checks, admin CRM, revenue dashboards) has a single source of
  // truth without reaching back into Stripe on every render.
  const customerId = sub.customer as string;

  const { data: profile } = await sb
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!profile) {
    console.log(`[Stripe] subscription.updated with no matching profile: ${customerId}`);
    return;
  }

  // Derive our internal status from Stripe's status + the
  // cancel_at_period_end flag. `cancel_at_period_end=true` means the
  // user clicked Cancel; they still have access through period end but
  // won't renew — we store that as 'cancelling' so UI can warn.
  const internalStatus =
    sub.cancel_at_period_end === true
      ? 'cancelling'
      : sub.status === 'active'
      ? 'active'
      : sub.status === 'past_due'
      ? 'past_due'
      : sub.status === 'canceled'
      ? 'cancelled'
      : sub.status; // trialing, unpaid, incomplete, etc. — stored raw.

  const isPremium = sub.status === 'active' || sub.status === 'trialing';

  await sb
    .from('profiles')
    .update({
      is_premium: isPremium,
      subscription_status: internalStatus,
    })
    .eq('id', profile.id);

  logEvent(sb, {
    actor_type: 'webhook',
    actor_id: 'stripe',
    event_type: 'subscription_updated',
    event_category: 'revenue',
    action: 'update',
    target_type: 'profile',
    target_id: profile.id,
    value_text: internalStatus,
    properties: {
      stripe_sub_id: sub.id,
      cancel_at_period_end: sub.cancel_at_period_end,
      status: sub.status,
    },
  });

  console.log(`[Stripe] Subscription updated: ${customerId}, status=${internalStatus}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // Full or partial refund. We find the transaction by
  // stripe_payment_intent_id and adjust.
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) return;

  const refundedAmount = (charge.amount_refunded || 0) / 100;
  const isFullRefund = charge.amount_refunded === charge.amount;

  // Find the original transaction
  const { data: tx } = await sb
    .from('transactions')
    .select('id, profile_id, amount, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (!tx) {
    console.log(`[Stripe] charge.refunded with no matching transaction: ${paymentIntentId}`);
    return;
  }

  // Mark the transaction as refunded. The current schema's status
  // CHECK constraint only allows 'refunded' (not 'partially_refunded')
  // and has no refunded_amount/refunded_at columns — see
  // supabase/migrations/021_transaction_refund_fields.sql for the
  // richer schema this handler will expand to once that migration
  // lands. Until then, we flag the row as 'refunded' for both full
  // and partial refunds and let logEvent carry the delta so analytics
  // can reconcile via the events table.
  await sb
    .from('transactions')
    .update({ status: 'refunded' })
    .eq('id', tx.id);

  // Decrement profile revenue by the refunded portion.
  if (tx.profile_id) {
    const { data: current } = await sb
      .from('profiles')
      .select('gross_revenue, total_spent')
      .eq('id', tx.profile_id)
      .maybeSingle();
    if (current) {
      await sb
        .from('profiles')
        .update({
          gross_revenue: Math.max(0, (parseFloat(current.gross_revenue) || 0) - refundedAmount),
          total_spent: Math.max(0, (parseFloat(current.total_spent) || 0) - refundedAmount),
        })
        .eq('id', tx.profile_id);
    }
  }

  logEvent(sb, {
    actor_type: 'webhook',
    actor_id: 'stripe',
    event_type: 'payment_refunded',
    event_category: 'revenue',
    action: 'update',
    target_type: 'profile',
    target_id: tx.profile_id || undefined,
    value_numeric: -refundedAmount,
    value_text: isFullRefund ? 'full_refund' : 'partial_refund',
    properties: {
      charge_id: charge.id,
      payment_intent: paymentIntentId,
      original_amount: (charge.amount || 0) / 100,
      refunded_amount: refundedAmount,
    },
  });

  console.log(`[Stripe] Refund: ${charge.id}, $${refundedAmount}, full=${isFullRefund}`);
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

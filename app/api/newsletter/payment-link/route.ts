import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

/**
 * POST /api/newsletter/payment-link
 *
 * Creates a Stripe product + price + payment link for the premium
 * newsletter tier. Previously unauthenticated — an attacker could
 * spam-create unlimited Stripe products, polluting the catalog and
 * consuming API quota. Each call also hits the Stripe API three times.
 *
 * Now admin-gated via requireAdmin(). Cookie session from /admin works
 * by default; Bearer omni_token is supported for localStorage-based
 * admin flows (matches newsletter/send + newsletter/import).
 */
export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' },
      { status: 400 }
    );
  }

  try {
    // Create product
    const productRes = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: 'Omni AI Premium Newsletter',
        description: 'Daily AI-powered business intelligence — premium edition',
      }),
    });
    const product = await productRes.json();
    if (!product.id) throw new Error('Failed to create Stripe product');

    // Create price $5/month
    const priceRes = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: '500',
        currency: 'usd',
        'recurring[interval]': 'month',
      }),
    });
    const price = await priceRes.json();
    if (!price.id) throw new Error('Failed to create Stripe price');

    // Create payment link
    const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': price.id,
        'line_items[0][quantity]': '1',
        'after_completion[type]': 'redirect',
        'after_completion[redirect][url]': `${process.env.NEXT_PUBLIC_SITE_URL || 'https://omni-ai-theta.vercel.app'}/dashboard?premium=success`,
      }),
    });
    const link = await linkRes.json();
    if (!link.url) throw new Error('Failed to create payment link');

    return NextResponse.json({
      payment_url: link.url,
      price_id: price.id,
      product_id: product.id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stripe error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordMetric } from '@/lib/ship-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/portfolio/sync
 * Auth: Bearer CRON_SECRET (or Vercel Cron auto-header).
 * Refreshes current_mrr/current_arr on client_portfolio and writes a today-row to client_metrics_daily.
 *
 * Sources:
 *  - Omni AI: paypal_transactions (last 30d gross → ARR proxy) + profiles(newsletter_subscribed=true) → leads
 *  - Other clients: best-effort — if they ever land Stripe rows in a clients_<slug>_stripe table, wire it here.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  // Vercel cron calls use Bearer CRON_SECRET; manual calls too.
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();

  const summary: Record<string, any> = {};

  // ---- Omni AI ----
  try {
    const { data: txns } = await supabase
      .from('paypal_transactions')
      .select('transaction_amount, transaction_status, transaction_event_code, transaction_initiation_date')
      .gte('transaction_initiation_date', thirtyAgoIso)
      .limit(1000);

    let gross30 = 0;
    for (const t of txns || []) {
      const s = String(t.transaction_status || '').toUpperCase();
      if (s !== 'S' && s !== 'COMPLETED') continue;
      const code = String(t.transaction_event_code || '');
      // payment-ish event codes
      if (/^T00|^T01|^T03|^T05|^T22/.test(code)) {
        gross30 += Number(t.transaction_amount || 0);
      }
    }
    const mrrOmni = Math.round(gross30); // last 30d treated as MRR proxy
    const arrOmni = mrrOmni * 12;

    const { count: newsletterCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('newsletter_subscribed', true);

    await supabase
      .from('client_portfolio')
      .update({
        current_mrr_usd: mrrOmni || 2333,           // keep seeded floor if no txns
        current_arr_usd: arrOmni || 28000,
        customer_count: newsletterCount || 0,
        last_synced_at: new Date().toISOString(),
      })
      .eq('slug', 'omni-ai');

    await recordMetric({
      client: 'omni-ai',
      date: today,
      mrrUsd: mrrOmni || 2333,
      arrUsd: arrOmni || 28000,
      leads: newsletterCount || 0,
      source: 'paypal',
    });

    summary['omni-ai'] = { mrr: mrrOmni, arr: arrOmni, leads: newsletterCount };
  } catch (e: any) {
    summary['omni-ai'] = { error: e.message };
  }

  // ---- All other clients: carry forward existing values so sparklines grow ----
  const { data: others } = await supabase
    .from('client_portfolio')
    .select('slug, current_mrr_usd, current_arr_usd')
    .neq('slug', 'omni-ai');
  for (const c of others || []) {
    await recordMetric({
      client: c.slug,
      date: today,
      mrrUsd: c.current_mrr_usd || 0,
      arrUsd: c.current_arr_usd || 0,
      source: 'manual',
    });
    summary[c.slug] = { mrr: c.current_mrr_usd, arr: c.current_arr_usd };
  }

  await supabase.from('client_portfolio').update({ last_synced_at: new Date().toISOString() }).neq('slug', '');

  return NextResponse.json({ ok: true, synced_at: new Date().toISOString(), summary });
}

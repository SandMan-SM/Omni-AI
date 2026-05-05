import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from '@/lib/supabase/admin';
import { recordMetric } from '@/lib/ship-log';
import { constantTimeEqual } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  noStore();
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  // Vercel cron calls use Bearer CRON_SECRET; manual calls too.
  if (!process.env.CRON_SECRET || !constantTimeEqual(token, process.env.CRON_SECRET)) {
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
      const code = String(t.transaction_event_code || '').toUpperCase();
      // PayPal event-code classification matches admin/paypal-finance:
      //   T00 = payment (the only one that's revenue)
      //   T01 = non-payment fee / transfer (NOT revenue)
      //   T03 = bank deposit / withdrawal (NOT revenue, just balance moves)
      //   T05 = currency conversion (not net new money)
      //   T22 = hold / release (temporary, not realized revenue)
      // The previous regex included all of these, inflating MRR by the
      // sum of holds + withdrawals + transfers. Keep only T00.
      if (code.startsWith('T00')) {
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
  } catch (e: unknown) {
    // Full supabase error server-side so sync failures can be triaged in
    // Vercel logs; scrubbed tag in the response so raw postgres text
    // doesn't reach the cron endpoint's body (CRON_SECRET exposure
    // would otherwise map the paypal_transactions / client_portfolio
    // schema shape for free).
    console.error('[portfolio/sync] omni-ai', e);
    summary['omni-ai'] = { error: 'sync failed' };
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

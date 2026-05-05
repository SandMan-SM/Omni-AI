import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/portfolio/clients
 * Returns every client with: current metrics, 30-day MRR spark, last ship, open risks count, % to $1M.
 * Admin-client (bypasses RLS). Only aggregated data — safe for the /command page to poll.
 */
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. The "aggregated" payload here is portfolio-wide MRR/ARR
  // + every client's current_arr_usd + risk severity — that's the
  // financial intel the /command page is gated behind admin auth for.
  // Without this gate the API endpoint leaks the same data unauth.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const supabase = createAdminClient();

  const [{ data: clients }, { data: metrics }, { data: lastShips }, { data: risks }] = await Promise.all([
    supabase.from('client_portfolio').select('*').order('current_arr_usd', { ascending: false }),
    supabase
      .from('client_metrics_daily')
      .select('client_slug, date, mrr_usd, arr_usd')
      .gte('date', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
      .order('date', { ascending: true }),
    supabase
      .from('build_log')
      .select('client_slug, title, kind, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('client_risks').select('client_slug, severity').is('resolved_at', null),
  ]);

  const sparkByClient: Record<string, number[]> = {};
  for (const m of metrics || []) {
    sparkByClient[m.client_slug] = sparkByClient[m.client_slug] || [];
    sparkByClient[m.client_slug].push(m.mrr_usd || 0);
  }

  const lastShipByClient: Record<string, { title: string; kind: string; created_at: string }> = {};
  for (const s of lastShips || []) {
    if (s.client_slug && !lastShipByClient[s.client_slug]) {
      lastShipByClient[s.client_slug] = { title: s.title, kind: s.kind, created_at: s.created_at };
    }
  }

  const riskCountByClient: Record<string, { red: number; yellow: number }> = {};
  for (const r of risks || []) {
    if (!r.client_slug) continue;
    riskCountByClient[r.client_slug] = riskCountByClient[r.client_slug] || { red: 0, yellow: 0 };
    if (r.severity === 'red') riskCountByClient[r.client_slug].red++;
    if (r.severity === 'yellow') riskCountByClient[r.client_slug].yellow++;
  }

  const enriched = (clients || []).map((c: any) => {
    const risk = riskCountByClient[c.slug] || { red: 0, yellow: 0 };
    const severity: 'red' | 'yellow' | 'green' = risk.red > 0 ? 'red' : risk.yellow > 0 ? 'yellow' : 'green';
    const target = c.arr_target_usd || 1_000_000;
    const progressPct = Math.min(100, Math.round((c.current_arr_usd / target) * 100));
    return {
      ...c,
      spark: sparkByClient[c.slug] || [],
      last_ship: lastShipByClient[c.slug] || null,
      severity,
      open_risks: risk,
      progress_pct: progressPct,
    };
  });

  return NextResponse.json({
    clients: enriched,
    portfolio_arr_usd: enriched.reduce((s, c) => s + (c.current_arr_usd || 0), 0),
    portfolio_mrr_usd: enriched.reduce((s, c) => s + (c.current_mrr_usd || 0), 0),
  });
}

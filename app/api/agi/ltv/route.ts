import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Lifetime Value calculator: forecasts revenue trajectory based on
// historical conversion rates, average deal size, and current pipeline.
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data: leads } = await supabase
    .from('omni_leads_generated')
    .select('deal_stage, deal_value, status, created_at, updated_at')
    .eq('business_id', business_id);

  const arr = leads ?? [];
  const won = arr.filter(l => l.deal_stage === 'closed_won');
  const lost = arr.filter(l => l.deal_stage === 'closed_lost');
  // "Open" = not yet closed at the deal-stage level AND not already marked
  // lost at the lead-status level. The previous filter excluded only
  // closed_won/closed_lost stages, so leads where the operator set
  // status='lost' (without setting deal_stage) still got rolled into the
  // weighted pipeline forecast — inflating projected revenue with
  // already-dead leads.
  const open = arr.filter(l =>
    !['closed_won', 'closed_lost'].includes(l.deal_stage ?? '') &&
    l.status !== 'lost',
  );

  // Historical metrics
  const totalWon = won.reduce((s, l) => s + (l.deal_value ?? 0), 0);
  const avgDealSize = won.length > 0 ? Math.round(totalWon / won.length) : 0;
  const winRate = (won.length + lost.length) > 0 ? won.length / (won.length + lost.length) : 0;

  // Stage probabilities (conservative)
  const stageProbability: Record<string, number> = {
    lead: 0.05, contacted: 0.1, qualified: 0.25, demo: 0.4,
    proposal: 0.6, negotiation: 0.8, closed_won: 1.0, closed_lost: 0,
  };

  // Weighted pipeline value
  const weightedPipeline = open.reduce((s, l) =>
    s + ((l.deal_value ?? 0) * (stageProbability[l.deal_stage ?? 'lead'] ?? 0.05)),
  0);

  // Forecast next 30/90/365 days based on velocity
  // Avg time to close in won deals
  const closeTimes = won
    .filter(l => l.created_at && l.updated_at)
    .map(l => (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000);
  const avgCloseDays = closeTimes.length > 0 ? closeTimes.reduce((s, t) => s + t, 0) / closeTimes.length : 30;

  // Current pipeline cycles per year
  const pipelineCyclesPerYear = avgCloseDays > 0 ? 365 / avgCloseDays : 12;

  // Annualized projection: weighted pipeline value * cycles per year
  const annualForecast = Math.round(weightedPipeline * pipelineCyclesPerYear);
  const month30 = Math.round(weightedPipeline * (30 / Math.max(avgCloseDays, 1)));
  const day90 = Math.round(weightedPipeline * (90 / Math.max(avgCloseDays, 1)));

  // Simple LTV: avgDealSize (assuming each customer = 1 deal for now)
  // For true LTV, would multiply by retention/expansion factor
  const ltv = avgDealSize;

  return NextResponse.json({
    historical: {
      total_won: won.length,
      total_lost: lost.length,
      revenue_won: totalWon,
      avg_deal_size: avgDealSize,
      win_rate: Math.round(winRate * 100),
      avg_close_days: Math.round(avgCloseDays),
    },
    pipeline: {
      open_count: open.length,
      raw_value: open.reduce((s, l) => s + (l.deal_value ?? 0), 0),
      weighted_value: Math.round(weightedPipeline),
    },
    forecast: {
      next_30_days: month30,
      next_90_days: day90,
      annual: annualForecast,
    },
    ltv: {
      per_customer: ltv,
      total_customer_count: won.length,
      total_lifetime_value: totalWon,
    },
  });
}

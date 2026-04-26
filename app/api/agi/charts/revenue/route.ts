import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Revenue chart data (daily series for the last N days)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const days = parseInt(searchParams.get('days') ?? '30');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  // Snapshot from won deals
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const { data: leads } = await supabase
    .from('omni_leads_generated')
    .select('updated_at, deal_value, deal_stage, created_at')
    .eq('business_id', business_id)
    .gte('updated_at', cutoff.toISOString());

  // Build daily series
  const series: Record<string, { revenue_won: number; deals_won: number; leads_added: number; pipeline_value: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series[key] = { revenue_won: 0, deals_won: 0, leads_added: 0, pipeline_value: 0 };
  }

  for (const l of leads ?? []) {
    const updatedKey = (l.updated_at ?? '').slice(0, 10);
    const createdKey = (l.created_at ?? '').slice(0, 10);
    if (l.deal_stage === 'closed_won' && series[updatedKey]) {
      series[updatedKey].revenue_won += l.deal_value ?? 0;
      series[updatedKey].deals_won++;
    }
    if (series[createdKey]) {
      series[createdKey].leads_added++;
      if (!['closed_won', 'closed_lost'].includes(l.deal_stage ?? '')) {
        series[createdKey].pipeline_value += l.deal_value ?? 0;
      }
    }
  }

  const points = Object.entries(series)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ points, days });
}

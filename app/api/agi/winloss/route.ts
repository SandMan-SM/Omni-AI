import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Capture win/loss reasoning when a deal closes
export async function POST(req: NextRequest) {
  const { lead_id, win_loss_category, win_loss_reason, competitor_name, deal_stage } = await req.json();
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const updates: Record<string, unknown> = { win_loss_category, win_loss_reason, competitor_name };
  if (deal_stage) updates.deal_stage = deal_stage;

  const { data, error } = await supabase
    .from('omni_leads_generated')
    .update(updates).eq('id', lead_id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}

// Aggregate win/loss reasons across business
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data: closed } = await supabase
    .from('omni_leads_generated')
    .select('deal_stage, win_loss_category, win_loss_reason, competitor_name, deal_value')
    .eq('business_id', business_id)
    .in('deal_stage', ['closed_won', 'closed_lost']);

  const closedArr = closed ?? [];
  const won = closedArr.filter(l => l.deal_stage === 'closed_won');
  const lost = closedArr.filter(l => l.deal_stage === 'closed_lost');

  const lossByCategory: Record<string, number> = {};
  for (const l of lost) {
    const cat = l.win_loss_category ?? 'unknown';
    lossByCategory[cat] = (lossByCategory[cat] ?? 0) + 1;
  }

  const competitors: Record<string, number> = {};
  for (const l of closedArr) {
    if (l.competitor_name) {
      competitors[l.competitor_name] = (competitors[l.competitor_name] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    won_count: won.length,
    lost_count: lost.length,
    win_rate: closedArr.length > 0 ? Math.round((won.length / closedArr.length) * 100) : 0,
    won_revenue: won.reduce((s, w) => s + (w.deal_value ?? 0), 0),
    lost_value: lost.reduce((s, w) => s + (w.deal_value ?? 0), 0),
    loss_by_category: lossByCategory,
    competitors,
  });
}

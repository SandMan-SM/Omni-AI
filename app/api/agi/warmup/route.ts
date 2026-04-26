import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Domain warmup status: today's send count, daily limit, reputation,
// 14-day history. Used by the dashboard widget + cron pre-flight check.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  // Ensure today's row exists with correct daily_limit (calls warmup curve)
  await supabase.rpc('omni_check_send_limit', { p_business_id: business_id });

  // Pull 14-day history
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const { data: history } = await supabase
    .from('omni_domain_warmup')
    .select('*')
    .eq('business_id', business_id)
    .gte('date', fourteenDaysAgo.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  const todayRow = history?.find(h => h.date === today);

  // Compute reputation: weighted bounce rate + reply rate
  const totalSends = (history ?? []).reduce((s, h) => s + (h.sends_count ?? 0), 0);
  const totalBounces = (history ?? []).reduce((s, h) => s + (h.bounces_count ?? 0), 0);
  const totalReplies = (history ?? []).reduce((s, h) => s + (h.replies_count ?? 0), 0);
  const bounceRate = totalSends > 0 ? totalBounces / totalSends : 0;
  const replyRate = totalSends > 0 ? totalReplies / totalSends : 0;

  // Reputation: 100 base, -2 per 1% bounce rate, +0.5 per 1% reply rate, capped 0-100
  const reputation = Math.min(100, Math.max(0,
    Math.round(100 - bounceRate * 200 + replyRate * 50)
  ));

  return NextResponse.json({
    today: {
      sends: todayRow?.sends_count ?? 0,
      limit: todayRow?.daily_limit ?? 20,
      remaining: (todayRow?.daily_limit ?? 20) - (todayRow?.sends_count ?? 0),
    },
    reputation,
    metrics: {
      total_sends: totalSends,
      bounce_rate: Math.round(bounceRate * 1000) / 10,
      reply_rate: Math.round(replyRate * 1000) / 10,
    },
    history,
  });
}

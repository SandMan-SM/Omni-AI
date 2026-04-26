import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Returns lead density grouped by location, industry, and title.
// Used for the dashboard heatmap visualization.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data: leads } = await supabase
    .from('omni_leads_generated')
    .select('lead_location, title, company, status, score, deal_stage, deal_value')
    .eq('business_id', business_id);

  const arr = leads ?? [];

  // Helper to bucket
  const bucket = (key: keyof typeof arr[number], normalize?: (v: string) => string) => {
    const counts: Record<string, { count: number; qualified: number; value: number; avg_score: number; total_score: number }> = {};
    for (const l of arr) {
      const raw = (l[key] as string | null) ?? 'Unknown';
      const k = normalize ? normalize(raw) : raw;
      if (!counts[k]) counts[k] = { count: 0, qualified: 0, value: 0, avg_score: 0, total_score: 0 };
      counts[k].count++;
      counts[k].total_score += l.score ?? 0;
      if (['qualified', 'converted'].includes(l.status)) counts[k].qualified++;
      counts[k].value += l.deal_value ?? 0;
    }
    return Object.entries(counts).map(([key, v]) => ({
      key, count: v.count, qualified: v.qualified, value: v.value,
      avg_score: Math.round(v.total_score / Math.max(v.count, 1)),
    })).sort((a, b) => b.count - a.count);
  };

  // Title buckets — normalize variations
  const titleNorm = (t: string) => {
    const lower = t.toLowerCase();
    if (lower.includes('director')) return 'Director';
    if (lower.includes('vp') || lower.includes('vice president')) return 'VP';
    if (lower.includes('manager')) return 'Manager';
    if (lower.includes('ceo') || lower.includes('founder')) return 'CEO/Founder';
    if (lower.includes('president')) return 'President';
    if (lower.includes('chief')) return 'C-Suite';
    if (lower.includes('head')) return 'Head';
    return t.split(' ').slice(0, 3).join(' ');
  };

  return NextResponse.json({
    by_location: bucket('lead_location'),
    by_company: bucket('company'),
    by_title: bucket('title', titleNorm),
    by_stage: bucket('deal_stage'),
    total: arr.length,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkCreditBudget } from '@/lib/agi/apollo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');

  if (!business_id) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }

  const budget = await checkCreditBudget(business_id);

  // Recent reveals
  const month = new Date().toISOString().slice(0, 7);
  const { data: record } = await supabase
    .from('omni_apollo_credits')
    .select('reveals')
    .eq('business_id', business_id)
    .eq('month', month)
    .single();

  return NextResponse.json({
    ...budget,
    recent_reveals: record?.reveals ?? [],
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { checkCreditBudget } from '@/lib/agi/apollo';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. The credits payload includes recent_reveals (the actual
  // contacts each tenant pulled from Apollo this month) — that's PII +
  // competitive intel about who they're prospecting.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
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

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

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  let query = supabase.from('omni_nurture_sequences').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sequences: data });
}

export async function POST(req: NextRequest) {
  const { business_id, name, description, steps } = await req.json();
  if (!business_id || !name || !Array.isArray(steps)) {
    return NextResponse.json({ error: 'business_id, name, steps[] required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_nurture_sequences').insert({ business_id, name, description, steps }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sequence: data });
}

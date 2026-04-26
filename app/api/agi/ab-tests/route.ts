import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Variant = { key: string; value: string; sent: number; opened: number; replied: number };

// CRUD for A/B tests + winner detection
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_ab_tests').select('*').eq('business_id', business_id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tests: data });
}

export async function POST(req: NextRequest) {
  const { business_id, name, test_type, variants } = await req.json();
  if (!business_id || !name || !Array.isArray(variants)) {
    return NextResponse.json({ error: 'business_id, name, variants[] required' }, { status: 400 });
  }
  // Init each variant with zero counters
  const initVariants: Variant[] = variants.map((v: { key: string; value: string }) => ({
    key: v.key, value: v.value, sent: 0, opened: 0, replied: 0,
  }));
  const { data, error } = await supabase
    .from('omni_ab_tests').insert({ business_id, name, test_type, variants: initVariants }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, test: data });
}

// Increment variant counter
export async function PATCH(req: NextRequest) {
  const { id, variant_key, metric } = await req.json();
  if (!id || !variant_key || !metric) {
    return NextResponse.json({ error: 'id, variant_key, metric required' }, { status: 400 });
  }
  if (!['sent', 'opened', 'replied'].includes(metric)) {
    return NextResponse.json({ error: 'metric must be sent/opened/replied' }, { status: 400 });
  }

  const { data: test } = await supabase.from('omni_ab_tests').select('*').eq('id', id).single();
  if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const variants = (test.variants ?? []) as Variant[];
  const v = variants.find(x => x.key === variant_key);
  if (!v) return NextResponse.json({ error: 'Variant key not found' }, { status: 404 });

  v[metric as 'sent' | 'opened' | 'replied']++;

  await supabase.from('omni_ab_tests').update({ variants }).eq('id', id);

  // Winner detection: if any variant has >= 30 sends and a 50%+ better open rate
  const ready = variants.every(x => x.sent >= 30);
  let winner: string | null = null;
  if (ready && !test.winner_key) {
    const sorted = [...variants].sort((a, b) =>
      (b.opened / Math.max(b.sent, 1)) - (a.opened / Math.max(a.sent, 1))
    );
    const top = sorted[0], second = sorted[1];
    const topRate = top.opened / top.sent;
    const secondRate = second.opened / second.sent;
    if (topRate > secondRate * 1.5) {
      winner = top.key;
      await supabase.from('omni_ab_tests').update({
        winner_key: winner, decided_at: new Date().toISOString(),
      }).eq('id', id);
    }
  }

  return NextResponse.json({ ok: true, variants, winner });
}

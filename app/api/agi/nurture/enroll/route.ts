import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Enroll one or many leads in a nurture sequence
export async function POST(req: NextRequest) {
  const { business_id, lead_ids, sequence_id } = await req.json() as {
    business_id: string;
    lead_ids: string[];
    sequence_id: string;
  };
  if (!business_id || !sequence_id || !Array.isArray(lead_ids)) {
    return NextResponse.json({ error: 'business_id, sequence_id, lead_ids[] required' }, { status: 400 });
  }

  const { data: sequence } = await supabase
    .from('omni_nurture_sequences').select('steps').eq('id', sequence_id).single();
  if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });

  const steps = (sequence.steps ?? []) as Array<{ day: number }>;
  const firstStep = steps[0];
  const nextSendAt = firstStep
    ? new Date(Date.now() + (firstStep.day ?? 0) * 86400000).toISOString()
    : null;

  const enrollments = lead_ids.map(lead_id => ({
    business_id, lead_id, sequence_id,
    current_step: 0, status: 'active' as const,
    next_send_at: nextSendAt,
  }));

  const { data, error } = await supabase
    .from('omni_nurture_enrollments')
    .upsert(enrollments, { onConflict: 'lead_id,sequence_id' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump enrolled count
  await supabase
    .from('omni_nurture_sequences')
    .update({ enrolled_count: (sequence as { enrolled_count?: number }).enrolled_count ?? 0 + lead_ids.length })
    .eq('id', sequence_id);

  return NextResponse.json({ ok: true, enrolled: data?.length ?? 0 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_nurture_enrollments')
    .select('*, lead:omni_leads_generated(first_name, last_name, company), sequence:omni_nurture_sequences(name)')
    .eq('business_id', business_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollments: data });
}

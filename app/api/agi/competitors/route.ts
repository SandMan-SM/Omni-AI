import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// CRUD for tracked competitors. Mentions are scanned across replies/notes.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const include_mentions = searchParams.get('include_mentions') === '1';

  let query = supabase.from('omni_competitors').select('*').order('mentions_count', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (include_mentions && business_id) {
    const { data: mentions } = await supabase
      .from('omni_competitor_mentions')
      .select('*, lead:omni_leads_generated(first_name, last_name, company)')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ competitors: data, mentions });
  }

  return NextResponse.json({ competitors: data });
}

export async function POST(req: NextRequest) {
  const { business_id, name, domain, notes } = await req.json();
  if (!business_id || !name) {
    return NextResponse.json({ error: 'business_id and name required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_competitors').insert({ business_id, name, domain, notes }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, competitor: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_competitors').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

// Scan all replies for competitor mentions, log new ones
export async function PUT(req: NextRequest) {
  const { business_id } = await req.json();
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data: competitors } = await supabase
    .from('omni_competitors').select('*').eq('business_id', business_id);
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, mentions_found: 0 });
  }

  const { data: replies } = await supabase
    .from('omni_outreach_assets')
    .select('id, lead_id, reply_text')
    .eq('business_id', business_id)
    .eq('status', 'replied')
    .not('reply_text', 'is', null);

  const repliesArr = replies ?? [];
  let mentionsFound = 0;

  for (const reply of repliesArr) {
    if (!reply.reply_text) continue;
    const lower = reply.reply_text.toLowerCase();
    for (const comp of competitors) {
      if (lower.includes(comp.name.toLowerCase())) {
        // Skip if already logged
        const { data: existing } = await supabase
          .from('omni_competitor_mentions')
          .select('id')
          .eq('competitor_id', comp.id)
          .eq('source_id', reply.id)
          .maybeSingle();
        if (existing) continue;

        await supabase.from('omni_competitor_mentions').insert({
          business_id, competitor_id: comp.id,
          lead_id: reply.lead_id,
          context_text: reply.reply_text.slice(0, 500),
          source: 'reply',
          source_id: reply.id,
        });
        mentionsFound++;

        // Increment competitor count
        await supabase
          .from('omni_competitors')
          .update({ mentions_count: (comp.mentions_count ?? 0) + 1 })
          .eq('id', comp.id);
      }
    }
  }

  return NextResponse.json({ ok: true, scanned: repliesArr.length, mentions_found: mentionsFound });
}

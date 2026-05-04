import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// User webhook subscription management
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_user_webhooks').select('*').eq('business_id', business_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data });
}

export async function POST(req: NextRequest) {
  const { business_id, endpoint_url, events } = await req.json();
  if (!business_id || !endpoint_url) {
    return NextResponse.json({ error: 'business_id and endpoint_url required' }, { status: 400 });
  }

  const secret = randomBytes(24).toString('hex');
  const { data, error } = await supabase
    .from('omni_user_webhooks')
    .insert({
      business_id, endpoint_url,
      events: events ?? ['lead.created', 'reply.received', 'booking.created'],
      secret,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return secret (only time it's visible in plaintext)
  return NextResponse.json({
    ok: true,
    webhook: data,
    note: 'Use the secret to verify X-OmniLeads-Signature header (HMAC-SHA256 of body). Save now.',
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_user_webhooks').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

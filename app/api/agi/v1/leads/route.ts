import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Public API v1: leads endpoint requires Authorization: Bearer omni_pk_...
async function authenticate(req: NextRequest): Promise<{ business_id: string } | { error: string; status: number }> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return { error: 'Missing Bearer token', status: 401 };
  const fullKey = auth.slice(7);
  const prefix = fullKey.slice(0, 12);
  const hash = createHash('sha256').update(fullKey).digest('hex');

  const { data: key } = await supabase
    .from('omni_api_keys')
    .select('id, business_id, key_hash, revoked_at, expires_at, request_count, scopes')
    .eq('key_prefix', prefix)
    .single();

  if (!key) return { error: 'Invalid API key', status: 401 };
  if (key.key_hash !== hash) return { error: 'Invalid API key', status: 401 };
  if (key.revoked_at) return { error: 'API key revoked', status: 401 };
  if (key.expires_at && new Date(key.expires_at) < new Date()) return { error: 'API key expired', status: 401 };

  // Bump usage
  await supabase
    .from('omni_api_keys')
    .update({
      request_count: (key.request_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', key.id);

  return { business_id: key.business_id };
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabase
    .from('omni_leads_generated')
    .select('id, first_name, last_name, email, phone, company, title, lead_location, source, status, deal_stage, deal_value, score, created_at')
    .eq('business_id', auth.business_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data,
    pagination: { limit, offset, returned: data?.length ?? 0 },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { first_name, last_name, email, phone, company, title, location, linkedin_url } = body;

  const { data, error } = await supabase
    .from('omni_leads_generated')
    .insert({
      business_id: auth.business_id,
      first_name, last_name, email, phone, company, title,
      lead_location: location, linkedin_url,
      source: 'manual' as const, status: 'new' as const,
      score: 60,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

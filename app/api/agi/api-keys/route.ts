import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Public API key management
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. The API-keys table is the auth surface for the public
  // API; even returning prefixes + scopes lets an attacker enumerate
  // a tenant's integrations and target the right key for credential
  // stuffing later.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_api_keys')
    .select('id, name, key_prefix, scopes, rate_limit_per_min, request_count, last_used_at, expires_at, revoked_at, created_at')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(req: NextRequest) {
  // Auth-gate. CRITICAL: POST mints a brand-new public API key for
  // any business_id and returns the full token. Without auth this is
  // a one-shot full takeover of any tenant's API surface.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, name, scopes, rate_limit_per_min, expires_at } = await req.json();
  if (!business_id || !name) {
    return NextResponse.json({ error: 'business_id and name required' }, { status: 400 });
  }

  // Generate key: omni_pk_<32 random chars>
  const random = randomBytes(24).toString('base64').replace(/[+/=]/g, '').slice(0, 32);
  const fullKey = `omni_pk_${random}`;
  const prefix = fullKey.slice(0, 12); // omni_pk_XXXX
  const hash = createHash('sha256').update(fullKey).digest('hex');

  const { data, error } = await supabase
    .from('omni_api_keys')
    .insert({
      business_id, name,
      key_prefix: prefix,
      key_hash: hash,
      scopes: scopes ?? ['read'],
      rate_limit_per_min: rate_limit_per_min ?? 60,
      expires_at: expires_at ?? null,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the FULL key once (only time it's visible)
  return NextResponse.json({
    ok: true,
    key: { ...data, full_key: fullKey },
    warning: 'Save this key now — it will never be shown again.',
  });
}

export async function DELETE(req: NextRequest) {
  // Auth-gate. DELETE revokes any tenant's API key by id — a denial-
  // of-service vector against integrations relying on those keys.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}

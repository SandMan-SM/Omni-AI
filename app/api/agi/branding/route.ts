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

// Manage white-label branding per business
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const subdomain = searchParams.get('subdomain');

  let query = supabase
    .from('omni_businesses')
    .select('id, name, brand_logo_url, brand_primary_color, brand_secondary_color, brand_subdomain, brand_signature_html, sender_name, sender_email');
  if (business_id) query = query.eq('id', business_id);
  if (subdomain) query = query.eq('brand_subdomain', subdomain);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branding: data });
}

// Branding-only allowlist on the businesses table. Without this a caller
// could PATCH `{ business_id, plan: 'enterprise' }` to upgrade their tier,
// or `{ business_id, contact_email: '<attacker>' }` to redirect notifications.
const PATCHABLE_BRANDING_FIELDS = new Set([
  'brand_logo_url', 'brand_primary_color', 'brand_subdomain',
  'partnership_blurb', 'sender_name', 'sender_email', 'sender_phone',
  'booking_url', 'website',
]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { business_id } = body as { business_id?: string };
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'business_id') continue;
    if (PATCHABLE_BRANDING_FIELDS.has(k)) updates[k] = v;
  }

  // Validate subdomain (alphanumeric + dash only)
  if (typeof updates.brand_subdomain === 'string') {
    if (!/^[a-z0-9-]{3,30}$/i.test(updates.brand_subdomain)) {
      return NextResponse.json({
        error: 'Subdomain must be 3-30 chars, letters/numbers/dashes only',
      }, { status: 400 });
    }
    updates.brand_subdomain = updates.brand_subdomain.toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('omni_businesses')
    .update(updates)
    .eq('id', business_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, branding: data });
}

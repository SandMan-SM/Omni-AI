import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Manage white-label branding per business
export async function GET(req: NextRequest) {
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

export async function PATCH(req: NextRequest) {
  const { business_id, ...updates } = await req.json();
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  // Validate subdomain (alphanumeric + dash only)
  if (updates.brand_subdomain) {
    if (!/^[a-z0-9-]{3,30}$/i.test(updates.brand_subdomain)) {
      return NextResponse.json({
        error: 'Subdomain must be 3-30 chars, letters/numbers/dashes only',
      }, { status: 400 });
    }
    updates.brand_subdomain = updates.brand_subdomain.toLowerCase();
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

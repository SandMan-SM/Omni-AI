import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  noStore();
  const { data, error } = await supabase
    .from('omni_sequence_templates')
    .select('*')
    .eq('is_public', true)
    .order('use_count', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

// Apply a template to a business: creates a campaign with that ICP
export async function POST(req: NextRequest) {
  // Auth-gate. POST mints a new campaign on the supplied business_id
  // (with the template's ICP wired in). Without auth, anyone can
  // create unlimited campaigns on any tenant — pollutes the campaigns
  // tab and arms downstream Claude generation against attacker ICP.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { template_id, business_id, name } = await req.json();
    if (!template_id || !business_id) {
      return NextResponse.json({ error: 'template_id and business_id required' }, { status: 400 });
    }

    const { data: tpl } = await supabase
      .from('omni_sequence_templates').select('*').eq('id', template_id).single();
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const { data: campaign, error } = await supabase
      .from('omni_lead_campaigns')
      .insert({
        business_id,
        name: name ?? tpl.name,
        icp: tpl.icp_template,
        status: 'active',
        leads_target: 100,
      })
      .select()
      .single();

    if (error) throw error;

    // Increment template usage counter
    await supabase
      .from('omni_sequence_templates')
      .update({ use_count: (tpl.use_count ?? 0) + 1 })
      .eq('id', template_id);

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    console.error('[templates apply]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

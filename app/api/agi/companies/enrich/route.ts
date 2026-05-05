import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Stores already-enriched company intel.
// The actual Apollo enrichment call is made client-side via the dashboard,
// which uses the Apollo MCP tool directly. This endpoint persists the result.
export async function POST(req: NextRequest) {
  // Auth-gate. POST upserts arbitrary org metadata into a tenant's
  // omni_company_intel by (business_id, domain). Without auth an
  // attacker could poison ICP data — fake "estimated_num_employees",
  // bogus funding events, attacker-controlled raw_data — which then
  // drives downstream Claude scoring + outreach generation.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id, domain, organization } = await req.json() as {
      business_id: string;
      domain: string;
      organization: Record<string, unknown>;
    };

    if (!business_id || !domain || !organization) {
      return NextResponse.json({ error: 'business_id, domain, organization required' }, { status: 400 });
    }

    const fundingEvents = organization.funding_events as Array<{ date?: string; type?: string; investors?: string }> | undefined;

    const row = {
      business_id,
      domain,
      apollo_id: organization.id as string ?? null,
      name: organization.name as string ?? null,
      industry: organization.industry as string ?? null,
      short_description: organization.short_description as string ?? null,
      founded_year: (organization.founded_year as number) ?? null,
      estimated_num_employees: (organization.estimated_num_employees as number) ?? null,
      city: organization.city as string ?? null,
      state: organization.state as string ?? null,
      country: organization.country as string ?? null,
      linkedin_url: organization.linkedin_url as string ?? null,
      technology_names: (organization.technology_names as string[]) ?? null,
      keywords: ((organization.keywords as string[]) ?? []).slice(0, 20),
      departmental_head_count: organization.departmental_head_count ?? null,
      latest_funding_stage: organization.latest_funding_stage as string ?? null,
      latest_funding_date: fundingEvents?.[0]?.date?.slice(0, 10) ?? null,
      funding_events: fundingEvents ?? null,
      raw_data: organization,
      enriched_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('omni_company_intel')
      .upsert(row, { onConflict: 'business_id,domain' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, company: data });
  } catch (err) {
    console.error('[companies/enrich]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

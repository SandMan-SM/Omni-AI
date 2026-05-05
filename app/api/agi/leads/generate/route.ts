import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ICP = {
  titles?: string[];
  industries?: string[];
  location?: string;
  keywords?: string[];
};

function scoreLeadLocal(lead: Record<string, unknown>, icp: ICP): number {
  let score = 50;
  const title = ((lead.title as string) ?? '').toLowerCase();
  const location = ((lead.lead_location as string) ?? '').toLowerCase();

  if (icp.titles?.some(t => title.includes(t.toLowerCase()))) score += 20;
  if (icp.location && location.includes(icp.location.toLowerCase())) score += 15;
  if (lead.email) score += 10;
  if (lead.phone) score += 5;

  return Math.min(100, Math.max(0, score));
}

// Admin-or-cron gated. Generates synthetic leads (currently demo data —
// future Apollo path) and inserts them into the supplied business_id.
// Without auth, anyone could spam-create leads under any tenant.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id, campaign_id, icp } = await req.json() as {
      business_id: string; campaign_id?: string; icp: ICP;
    };

    if (!business_id || !icp) {
      return NextResponse.json({ error: 'business_id and icp required' }, { status: 400 });
    }

    // Mock leads (Apollo free tier blocks broad search; the real path uses
    // the Outreach tab which calls Apollo MCP with a name+company match).
    const rawLeads = [
      { first_name: 'Alex', last_name: 'Rivera', email: 'arivera@demo.com', phone: null, company: 'Demo Corp', title: icp.titles?.[0] ?? 'Manager', lead_location: icp.location ?? 'Remote', linkedin_url: null, source: 'apollo' as const },
      { first_name: 'Jordan', last_name: 'Kim', email: 'jkim@sample.io', phone: '555-0101', company: 'Sample Inc', title: icp.titles?.[1] ?? 'Director', lead_location: icp.location ?? 'Remote', linkedin_url: null, source: 'web' as const },
    ];

    const leadsToInsert = rawLeads.map(l => ({
      ...l, business_id, campaign_id: campaign_id ?? null,
      score: scoreLeadLocal(l as Record<string, unknown>, icp),
      status: 'new' as const,
    }));

    const { data, error } = await supabase
      .from('omni_leads_generated')
      .insert(leadsToInsert)
      .select();

    if (error) throw error;
    return NextResponse.json({ inserted: data?.length ?? 0, leads: data });
  } catch (err) {
    console.error('[leads/generate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

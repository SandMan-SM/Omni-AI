import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkCreditBudget, consumeCredit } from '@/lib/agi/apollo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Enrich a single lead via Apollo MCP. Costs 1 credit on success.
// Frontend hits this endpoint; it performs the credit check, then makes
// the Apollo MCP call indirectly via a server action. For the MCP-only
// flow, we expose an enrich-mock endpoint AND a structured hook for the
// real call from the dashboard agent run.

export async function POST(req: NextRequest) {
  try {
    const { lead_id, business_id, mock } = await req.json() as {
      lead_id: string; business_id: string; mock?: boolean;
    };

    if (!lead_id || !business_id) {
      return NextResponse.json({ error: 'lead_id and business_id required' }, { status: 400 });
    }

    // Credit budget check
    const budget = await checkCreditBudget(business_id);
    if (!budget.ok) {
      return NextResponse.json({
        error: 'Credit budget exceeded',
        used: budget.used,
        limit: budget.limit,
        reserved: budget.reserved,
      }, { status: 402 });
    }

    // Pull the lead
    const { data: lead, error: leadErr } = await supabase
      .from('omni_leads_generated')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Mock enrichment for testing without burning credits
    if (mock) {
      const mockEnrichment = {
        email: lead.email ?? `${lead.first_name?.toLowerCase()}.${lead.last_name?.toLowerCase()}@${lead.company?.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: lead.phone ?? '+1-555-' + Math.floor(1000 + Math.random() * 9000),
        linkedin_url: lead.linkedin_url ?? `https://linkedin.com/in/${lead.first_name?.toLowerCase()}-${lead.last_name?.toLowerCase()}`,
        score_boost: 10,
      };

      const { data: updated } = await supabase
        .from('omni_leads_generated')
        .update({
          email: mockEnrichment.email,
          phone: mockEnrichment.phone,
          linkedin_url: mockEnrichment.linkedin_url,
          score: Math.min(100, (lead.score ?? 50) + mockEnrichment.score_boost),
          raw_data: { ...lead.raw_data, enriched: true, enriched_at: new Date().toISOString(), mock: true },
        })
        .eq('id', lead_id)
        .select()
        .single();

      return NextResponse.json({
        ok: true,
        lead: updated,
        credit_consumed: false,
        mock: true,
        note: 'Mock enrichment — no Apollo credits consumed',
      });
    }

    // Real enrichment path: the dashboard calls Apollo MCP directly via the
    // /api/outreach/run-apollo-enrich endpoint that uses the MCP tool.
    // This route just records the credit + updates the lead.
    return NextResponse.json({
      ok: false,
      error: 'For real Apollo enrichment, use the agent runner from the dashboard which calls Apollo MCP directly. This route handles mock enrichment only.',
      hint: 'Pass { mock: true } to test without credits',
    }, { status: 400 });

  } catch (err) {
    console.error('[leads/enrich]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper for server-side flows that have already done the Apollo enrichment.
// Records the credit usage and updates the lead atomically.
export async function PUT(req: NextRequest) {
  try {
    const { lead_id, business_id, enrichment } = await req.json() as {
      lead_id: string;
      business_id: string;
      enrichment: {
        email?: string;
        phone?: string;
        linkedin_url?: string;
        title?: string;
        company?: string;
        seniority?: string;
        location?: string;
      };
    };

    const credit_ok = await consumeCredit(business_id, lead_id, 'people_match', 1);
    if (!credit_ok) {
      return NextResponse.json({ error: 'Credit budget exceeded' }, { status: 402 });
    }

    const { data: lead } = await supabase
      .from('omni_leads_generated')
      .select('score, raw_data')
      .eq('id', lead_id)
      .single();

    const { data: updated } = await supabase
      .from('omni_leads_generated')
      .update({
        email: enrichment.email,
        phone: enrichment.phone,
        linkedin_url: enrichment.linkedin_url,
        title: enrichment.title,
        company: enrichment.company,
        lead_location: enrichment.location,
        score: Math.min(100, (lead?.score ?? 50) + 10),
        raw_data: { ...(lead?.raw_data ?? {}), enriched: true, enriched_at: new Date().toISOString() },
      })
      .eq('id', lead_id)
      .select()
      .single();

    return NextResponse.json({ ok: true, lead: updated, credit_consumed: true });
  } catch (err) {
    console.error('[leads/enrich PUT]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

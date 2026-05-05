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

// Universal search: leads + replies + meetings + notes
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  if (!business_id || !q) {
    return NextResponse.json({ error: 'business_id and q required' }, { status: 400 });
  }

  // PostgREST's .or() uses commas as separators and parens for grouping —
  // a search for "John, CTO" broke the filter parser and returned empty.
  // Strip syntactically reserved chars + SQL wildcards `%` / `_` (so users
  // typing them get literal matching) before building the ILIKE pattern.
  const cleaned = q.replace(/[,()%_\\]/g, ' ').trim();
  if (!cleaned) {
    return NextResponse.json({
      query: q, leads: [], replies: [], bookings: [], companies: [], total: 0,
    });
  }
  const pattern = `%${cleaned}%`;

  const [
    { data: leads },
    { data: replies },
    { data: bookings },
    { data: companies },
  ] = await Promise.all([
    supabase
      .from('omni_leads_generated')
      .select('id, first_name, last_name, email, company, title, score, deal_stage')
      .eq('business_id', business_id)
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern},title.ilike.${pattern},notes.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from('omni_outreach_assets')
      .select('id, lead_id, subject, reply_text, reply_category, replied_at, lead:omni_leads_generated(first_name, last_name, company)')
      .eq('business_id', business_id)
      .ilike('reply_text', pattern)
      .limit(limit),
    supabase
      .from('omni_meeting_bookings')
      .select('id, attendee_name, attendee_email, attendee_notes, start_at')
      .eq('business_id', business_id)
      .or(`attendee_name.ilike.${pattern},attendee_email.ilike.${pattern},attendee_notes.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from('omni_company_intel')
      .select('id, name, industry, domain, estimated_num_employees')
      .eq('business_id', business_id)
      .or(`name.ilike.${pattern},industry.ilike.${pattern},domain.ilike.${pattern}`)
      .limit(limit),
  ]);

  return NextResponse.json({
    query: q,
    leads: leads ?? [],
    replies: replies ?? [],
    bookings: bookings ?? [],
    companies: companies ?? [],
    total: (leads?.length ?? 0) + (replies?.length ?? 0) + (bookings?.length ?? 0) + (companies?.length ?? 0),
  });
}

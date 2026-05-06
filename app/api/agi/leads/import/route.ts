import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ImportRow = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  location?: string;
  linkedin_url?: string;
};

// Score on imported fields only (no Apollo calls).
function scoreImportedLead(row: ImportRow): number {
  let score = 40;
  if (row.email) score += 15;
  if (row.phone) score += 10;
  if (row.linkedin_url) score += 8;
  if (row.title) score += 12;
  if (row.company) score += 8;
  if (row.location) score += 7;
  return Math.min(100, score);
}

// Admin-or-cron gated. Imports lead rows in bulk under whatever
// business_id the caller supplies — without auth, anyone could spray
// arbitrary first_name/email/phone/title rows into any tenant's
// omni_leads_generated table.
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id, campaign_id, rows } = await req.json() as {
      business_id: string;
      campaign_id?: string;
      rows: ImportRow[];
    };

    if (!business_id || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'business_id and rows[] required' }, { status: 400 });
    }

    const validRows = rows.filter(r => r.first_name || r.last_name || r.email || r.company);
    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });
    }

    // Dedup: pull existing emails + linkedin URLs for this business
    const { data: existing } = await supabase
      .from('omni_leads_generated')
      .select('email, linkedin_url')
      .eq('business_id', business_id);

    const existingEmails = new Set((existing ?? []).map(e => e.email?.toLowerCase()).filter(Boolean) as string[]);
    const existingLinkedins = new Set((existing ?? []).map(e => e.linkedin_url).filter(Boolean) as string[]);

    // Track duplicates against the DB AND against rows already accepted
    // earlier in THIS batch. Without the in-batch dedup, a CSV with the
    // same email/linkedin twice would pass the DB check (only one was in
    // DB) and then both inserts would land — except the unique index on
    // omni_leads_generated would reject the second one and the entire
    // .insert([...]) call throws, returning the operator a generic 500
    // for what's actually just a duplicate row inside their CSV.
    let duplicates = 0;
    const seenEmails = new Set<string>();
    const seenLinkedins = new Set<string>();
    const leadsToInsert = validRows
      .filter(r => {
        const emailKey = r.email?.toLowerCase();
        if (emailKey && existingEmails.has(emailKey)) { duplicates++; return false; }
        if (emailKey && seenEmails.has(emailKey)) { duplicates++; return false; }
        if (r.linkedin_url && existingLinkedins.has(r.linkedin_url)) { duplicates++; return false; }
        if (r.linkedin_url && seenLinkedins.has(r.linkedin_url)) { duplicates++; return false; }
        if (emailKey) seenEmails.add(emailKey);
        if (r.linkedin_url) seenLinkedins.add(r.linkedin_url);
        return true;
      })
      .map(r => ({
        business_id,
        campaign_id: campaign_id ?? null,
        first_name: r.first_name ?? null,
        last_name: r.last_name ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        company: r.company ?? null,
        title: r.title ?? null,
        lead_location: r.location ?? null,
        linkedin_url: r.linkedin_url ?? null,
        source: 'manual' as const,
        status: 'new' as const,
        score: scoreImportedLead(r),
      }));

    if (leadsToInsert.length === 0) {
      return NextResponse.json({
        ok: true, inserted: 0, duplicates,
        note: `All ${validRows.length} rows were duplicates of existing leads.`,
      });
    }

    const { data, error } = await supabase
      .from('omni_leads_generated')
      .insert(leadsToInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      inserted: data?.length ?? 0,
      duplicates,
      leads: data,
    });
  } catch (err) {
    console.error('[leads/import]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

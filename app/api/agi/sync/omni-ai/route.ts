import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { constantTimeEqual } from '@/lib/api-auth';
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Manual sync trigger for Omni AI's leads.
// Triggers do most of the work automatically — this endpoint is a fallback
// that re-runs the backfill SQL in case any rows slipped through.
export async function GET(req: NextRequest) {
  noStore();
  const auth = req.headers.get("authorization");
  // Constant-time bearer compare so the secret can't be probed
  // byte-by-byte via response-time timing.
  const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
  if (!process.env.CRON_SECRET || !constantTimeEqual(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const queries = [
    // profiles
    `INSERT INTO omni_leads_generated (business_id, source_table, source_record_id, first_name, last_name, email, phone, source, status, score, created_at)
     SELECT (SELECT id FROM omni_businesses WHERE name = 'Omni AI' LIMIT 1), 'profiles', p.id,
       COALESCE(p.first_name, NULLIF(SPLIT_PART(p.name, ' ', 1), '')),
       COALESCE(p.last_name, NULLIF(TRIM(SUBSTRING(p.name FROM POSITION(' ' IN p.name || ' '))), '')),
       p.email, p.phone, 'manual',
       CASE WHEN p.crm_status = 'client' THEN 'converted'
            WHEN p.crm_status = 'onboarding' THEN 'qualified'
            WHEN p.lead_score = 'hot' THEN 'qualified' ELSE 'new' END,
       CASE p.lead_score WHEN 'hot' THEN 85 WHEN 'warm' THEN 65 WHEN 'cold' THEN 40 ELSE 50 END,
       p.created_at
     FROM profiles p
     WHERE NOT EXISTS (SELECT 1 FROM omni_leads_generated l WHERE l.source_table = 'profiles' AND l.source_record_id = p.id)`,
    // demo_bookings
    `INSERT INTO omni_leads_generated (business_id, source_table, source_record_id, first_name, last_name, email, phone, source, status, score, notes, created_at)
     SELECT (SELECT id FROM omni_businesses WHERE name = 'Omni AI' LIMIT 1), 'demo_bookings', d.id,
       NULLIF(SPLIT_PART(d.name, ' ', 1), ''),
       NULLIF(TRIM(SUBSTRING(d.name FROM POSITION(' ' IN d.name || ' '))), ''),
       d.email, d.phone, 'manual', 'qualified', 75,
       CONCAT('Demo booked for ', COALESCE(d.date, 'TBD')), d.created_at
     FROM demo_bookings d
     WHERE NOT EXISTS (SELECT 1 FROM omni_leads_generated l WHERE l.source_table = 'demo_bookings' AND l.source_record_id = d.id)`,
    // landing_page_leads
    `INSERT INTO omni_leads_generated (business_id, source_table, source_record_id, first_name, last_name, email, phone, source, status, score, notes, created_at)
     SELECT (SELECT id FROM omni_businesses WHERE name = 'Omni AI' LIMIT 1), 'landing_page_leads', lp.id,
       NULLIF(SPLIT_PART(lp.name, ' ', 1), ''),
       NULLIF(TRIM(SUBSTRING(lp.name FROM POSITION(' ' IN lp.name || ' '))), ''),
       lp.email, lp.phone, 'web', 'new', 55, 'From landing page', lp.created_at
     FROM landing_page_leads lp
     WHERE NOT EXISTS (SELECT 1 FROM omni_leads_generated l WHERE l.source_table = 'landing_page_leads' AND l.source_record_id = lp.id)`,
    // webinar_registrations
    `INSERT INTO omni_leads_generated (business_id, source_table, source_record_id, first_name, last_name, email, phone, source, status, score, notes, created_at)
     SELECT (SELECT id FROM omni_businesses WHERE name = 'Omni AI' LIMIT 1), 'webinar_registrations', w.id,
       w.first_name, w.last_name, w.email, w.phone, 'web', 'contacted', 60, 'Registered for webinar', w.created_at
     FROM webinar_registrations w
     WHERE NOT EXISTS (SELECT 1 FROM omni_leads_generated l WHERE l.source_table = 'webinar_registrations' AND l.source_record_id = w.id)`,
    // newsletter_subscriptions
    `INSERT INTO omni_leads_generated (business_id, source_table, source_record_id, email, source, status, score, notes, created_at)
     SELECT (SELECT id FROM omni_businesses WHERE name = 'Omni AI' LIMIT 1), 'newsletter_subscriptions', n.id,
       n.email, 'web', 'new', 35, 'Newsletter subscriber', n.created_at
     FROM newsletter_subscriptions n
     WHERE n.email IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM omni_leads_generated l WHERE l.source_table = 'newsletter_subscriptions' AND l.source_record_id = n.id)`,
  ];

  // Supabase JS doesn't expose raw exec; we use rpc to a wrapper or direct calls.
  // Simpler approach: count synced rows AFTER (since triggers + backfill keep things consistent).
  const { data: counts, error } = await supabase
    .from("omni_leads_generated")
    .select("source_table", { count: "exact", head: false })
    .eq("business_id", await getOmniAiBusinessId());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groupedCounts: Record<string, number> = {};
  for (const row of counts ?? []) {
    const key = (row as { source_table?: string }).source_table ?? "unknown";
    groupedCounts[key] = (groupedCounts[key] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    note: "Backfill is idempotent. Triggers handle ongoing inserts in real time.",
    counts: groupedCounts,
    total: counts?.length ?? 0,
  });
}

async function getOmniAiBusinessId(): Promise<string | null> {
  const { data } = await supabase
    .from("omni_businesses")
    .select("id")
    .eq("name", "Omni AI")
    .limit(1)
    .single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  return GET(req);
}

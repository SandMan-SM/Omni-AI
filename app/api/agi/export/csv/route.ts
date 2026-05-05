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

// CSV export — returns text/csv content for any data type
//   ?type=leads | replies | bookings | activity
//   &business_id=...
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const type = searchParams.get('type') ?? 'leads';
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (type === 'leads') {
    columns = ['first_name', 'last_name', 'email', 'phone', 'company', 'title', 'lead_location', 'linkedin_url', 'source', 'status', 'deal_stage', 'deal_value', 'score', 'created_at'];
    const { data } = await supabase
      .from('omni_leads_generated').select(columns.join(','))
      .eq('business_id', business_id);
    rows = (data ?? []) as unknown as Record<string, unknown>[];
  } else if (type === 'replies') {
    columns = ['lead_first', 'lead_last', 'lead_company', 'subject', 'reply_text', 'reply_category', 'reply_sentiment', 'replied_at'];
    const { data } = await supabase
      .from('omni_outreach_assets')
      .select('subject, reply_text, reply_category, reply_sentiment, replied_at, lead:omni_leads_generated(first_name, last_name, company)')
      .eq('business_id', business_id).eq('status', 'replied');
    rows = (data ?? []).map(r => {
      type LeadJoin = { first_name: string | null; last_name: string | null; company: string | null };
      const rec = r as unknown as { lead?: LeadJoin | LeadJoin[] | null; subject?: string; reply_text?: string; reply_category?: string; reply_sentiment?: string; replied_at?: string };
      const lead = Array.isArray(rec.lead) ? rec.lead[0] : rec.lead;
      return {
        lead_first: lead?.first_name ?? '',
        lead_last: lead?.last_name ?? '',
        lead_company: lead?.company ?? '',
        subject: rec.subject ?? '',
        reply_text: rec.reply_text ?? '',
        reply_category: rec.reply_category ?? '',
        reply_sentiment: rec.reply_sentiment ?? '',
        replied_at: rec.replied_at ?? '',
      };
    });
  } else if (type === 'bookings') {
    columns = ['attendee_name', 'attendee_email', 'attendee_phone', 'attendee_notes', 'start_at', 'duration_minutes', 'status', 'created_at'];
    const { data } = await supabase
      .from('omni_meeting_bookings').select(columns.join(','))
      .eq('business_id', business_id);
    rows = (data ?? []) as unknown as Record<string, unknown>[];
  } else if (type === 'activity') {
    columns = ['lead_first', 'lead_company', 'event_type', 'event_subtype', 'created_at'];
    const { data } = await supabase
      .from('omni_lead_activity')
      .select('event_type, event_subtype, created_at, lead:omni_leads_generated(first_name, company)')
      .eq('business_id', business_id);
    rows = (data ?? []).map(r => {
      type LeadJoin = { first_name?: string | null; company?: string | null };
      const rec = r as unknown as { lead?: LeadJoin | LeadJoin[] | null; event_type?: string; event_subtype?: string; created_at?: string };
      const lead = Array.isArray(rec.lead) ? rec.lead[0] : rec.lead;
      return {
        lead_first: lead?.first_name ?? '',
        lead_company: lead?.company ?? '',
        event_type: rec.event_type ?? '',
        event_subtype: rec.event_subtype ?? '',
        created_at: rec.created_at ?? '',
      };
    });
  } else {
    return NextResponse.json({ error: 'Invalid type. Use: leads, replies, bookings, activity' }, { status: 400 });
  }

  // Build CSV. Two protections:
  //   1. Quote/escape commas, quotes, and newlines (RFC 4180).
  //   2. Defuse formula injection — Excel and Google Sheets execute any
  //      cell that starts with =, +, -, @, or tab as a formula on open.
  //      A lead whose name was set to `=HYPERLINK("//evil","click me")`
  //      would, before this guard, ship as live HYPERLINK in every export
  //      the operator sent to a customer. Prefix offending cells with a
  //      leading apostrophe — Excel reads that as "treat as text."
  const FORMULA_LEAD = /^[=+\-@\t\r]/;
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    let s = String(v).replace(/\r?\n/g, ' ');
    if (FORMULA_LEAD.test(s)) s = `'${s}`;
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    columns.join(','),
    ...rows.map(r => columns.map(c => escape(r[c])).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="omnileads-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

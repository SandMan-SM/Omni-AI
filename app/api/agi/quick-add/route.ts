import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Quick-add lead capture endpoint. Designed to be hit by a bookmarklet
// or browser extension. Accepts loose data, normalizes, dedupes, returns lead.
//
// Bookmarklet javascript example (paste in homepage):
//   javascript:(function(){
//     var sel=window.getSelection().toString();
//     var name=prompt('Name?'); var title=prompt('Title?'); var company=prompt('Company?');
//     fetch('https://omnileadsagi.com/api/quick-add', {
//       method:'POST',
//       headers:{'Content-Type':'application/json'},
//       body:JSON.stringify({business_id:'YOUR_BIZ_ID', first_name:name, title, company, source_url:location.href, raw_text:sel})
//     }).then(r=>r.json()).then(d=>alert('Added! '+d.lead.first_name));
//   })();
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      business_id, first_name, last_name, email, phone, title,
      company, location, linkedin_url, source_url, raw_text,
    } = body;

    if (!business_id) {
      return NextResponse.json({ error: 'business_id required' }, { status: 400 });
    }

    // Log the capture for audit
    const { data: capture } = await supabase
      .from('omni_quick_captures')
      .insert({
        business_id,
        source_url,
        raw_text,
        parsed_data: body,
        status: 'pending',
      })
      .select()
      .single();

    // If we have enough to make a lead, do it now
    if (first_name || email || company) {
      // Dedup
      if (email) {
        const { data: dup } = await supabase
          .from('omni_leads_generated')
          .select('id')
          .eq('business_id', business_id)
          .ilike('email', email)
          .maybeSingle();
        if (dup) {
          await supabase
            .from('omni_quick_captures')
            .update({ status: 'rejected', promoted_to_lead_id: dup.id })
            .eq('id', capture?.id);
          return NextResponse.json({
            ok: true, duplicate: true,
            lead: { id: dup.id },
            note: 'Lead already exists — skipped',
          });
        }
      }

      const { data: lead } = await supabase
        .from('omni_leads_generated')
        .insert({
          business_id,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          email: email ?? null,
          phone: phone ?? null,
          title: title ?? null,
          company: company ?? null,
          lead_location: location ?? null,
          linkedin_url: linkedin_url ?? null,
          source: 'manual' as const,
          status: 'new' as const,
          score: 65,
          raw_data: { source_url, captured_at: new Date().toISOString() },
        })
        .select()
        .single();

      if (lead) {
        await supabase
          .from('omni_quick_captures')
          .update({ status: 'promoted', promoted_to_lead_id: lead.id })
          .eq('id', capture?.id);
      }

      return NextResponse.json({ ok: true, lead, capture_id: capture?.id });
    }

    return NextResponse.json({
      ok: true,
      capture_id: capture?.id,
      note: 'Captured. Need first_name, email, or company to promote to lead.',
    });
  } catch (err) {
    console.error('[quick-add]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

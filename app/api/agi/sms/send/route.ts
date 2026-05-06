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

// SMS via Twilio. Requires:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER
//
// Admin-or-cron gated. Each call is a billable Twilio SMS — without auth,
// anyone could POST `{ to_phone: '+1...', body: 'spam' }` repeatedly to
// drain the operator's Twilio balance and use the omnileadsagi number to
// blast arbitrary numbers (carrier abuse + 10DLC violation risk).
export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { business_id, lead_id, to_phone, body, scheduled_at } = await req.json();

    if (!business_id || !to_phone || !body) {
      return NextResponse.json({ error: 'business_id, to_phone, body required' }, { status: 400 });
    }

    // Check suppression list
    if (lead_id) {
      const { data: lead } = await supabase
        .from('omni_leads_generated').select('email').eq('id', lead_id).single();
      if (lead?.email) {
        const { data: isSuppressed } = await supabase.rpc('omni_is_suppressed', {
          p_business_id: business_id, p_email: lead.email,
        });
        if (isSuppressed) {
          return NextResponse.json({ error: 'Recipient is suppressed' }, { status: 403 });
        }
      }
    }

    // Save record
    const { data: smsRecord } = await supabase
      .from('omni_sms_sends')
      .insert({
        business_id, lead_id,
        to_phone, body,
        status: scheduled_at ? 'scheduled' : 'draft',
        scheduled_at,
      })
      .select().single();

    // If scheduled, return now
    if (scheduled_at) {
      return NextResponse.json({ ok: true, scheduled: true, sms: smsRecord });
    }

    // Send via Twilio if configured
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      // Stub mode
      await supabase
        .from('omni_sms_sends')
        .update({ status: 'sent', sent_at: new Date().toISOString(), twilio_sid: `stub-${Date.now()}` })
        .eq('id', smsRecord?.id);
      return NextResponse.json({
        ok: true,
        stub: true,
        sms: smsRecord,
        note: 'Twilio not configured. SMS marked sent but not delivered.',
      });
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ From: from, To: to_phone, Body: body });
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const result = await resp.json();

    if (!resp.ok) {
      await supabase
        .from('omni_sms_sends')
        .update({ status: 'failed' })
        .eq('id', smsRecord?.id);
      return NextResponse.json({ error: result.message ?? 'Twilio error' }, { status: 500 });
    }

    await supabase
      .from('omni_sms_sends')
      .update({
        status: 'sent', sent_at: new Date().toISOString(),
        twilio_sid: result.sid,
      })
      .eq('id', smsRecord?.id);

    return NextResponse.json({ ok: true, sms: smsRecord, twilio_sid: result.sid });
  } catch (err) {
    console.error('[sms/send]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Without business_id, this dumps every tenant's SMS
  // history (to_phone + body) — and even with business_id, the lack
  // of an auth check meant any guessed tenant id leaked the row set.
  // Body of an SMS often includes booking links, deal-value hints,
  // and other lead-context strings the operator wrote.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  const lead_id = searchParams.get('lead_id');

  let query = supabase.from('omni_sms_sends').select('*').order('created_at', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  if (lead_id) query = query.eq('lead_id', lead_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sms: data });
}

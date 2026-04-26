import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyBooking } from '@/lib/agi/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  let query = supabase
    .from('omni_meeting_bookings')
    .select('*, lead:omni_leads_generated(first_name, last_name, company)')
    .order('start_at', { ascending: true });
  if (business_id) query = query.eq('business_id', business_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data });
}

export async function POST(req: NextRequest) {
  try {
    const {
      business_id, lead_id, start_at, duration_minutes,
      attendee_name, attendee_email, attendee_phone, attendee_notes,
    } = await req.json();

    if (!business_id || !start_at || !attendee_name || !attendee_email) {
      return NextResponse.json({ error: 'business_id, start_at, attendee_name, attendee_email required' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('omni_meeting_bookings')
      .select('id').eq('business_id', business_id)
      .eq('start_at', start_at).eq('status', 'confirmed').limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Slot already booked' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('omni_meeting_bookings')
      .insert({
        business_id, lead_id: lead_id ?? null,
        start_at, duration_minutes: duration_minutes ?? 15,
        attendee_name, attendee_email,
        attendee_phone: attendee_phone ?? null,
        attendee_notes: attendee_notes ?? null,
        status: 'confirmed',
      })
      .select().single();
    if (error) throw error;

    if (lead_id) {
      await supabase
        .from('omni_leads_generated')
        .update({ status: 'qualified' })
        .eq('id', lead_id)
        .in('status', ['new', 'contacted']);
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      notifyBooking({ attendeeName: attendee_name, attendeeEmail: attendee_email, start_at }).catch(() => {});
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (err) {
    console.error('[meetings/book]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

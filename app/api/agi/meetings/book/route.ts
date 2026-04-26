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

// PATCH — reschedule, edit notes, change status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body as {
      id: string;
      start_at?: string;
      duration_minutes?: number;
      attendee_notes?: string | null;
      attendee_phone?: string | null;
      status?: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
      meeting_url?: string | null;
    };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Strip undefineds so we don't blank existing fields
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) update[k] = v;
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('omni_meeting_bookings')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, booking: data });
  } catch (err) {
    console.error('[meetings/book PATCH]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

// DELETE — cancel a meeting (soft: status=cancelled, keeps audit trail)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hard = searchParams.get('hard') === '1';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (hard) {
      const { error } = await supabase.from('omni_meeting_bookings').delete().eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('omni_meeting_bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[meetings/book DELETE]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

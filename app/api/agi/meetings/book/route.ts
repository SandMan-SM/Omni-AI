import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { notifyBooking } from '@/lib/agi/telegram';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  noStore();
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

    // Mirror into the per-tenant inbound_<slug>_bookings analytics table so
    // the workspace dashboard's Site Analytics "Bookings 30d" KPI counts
    // bookings made through the agentic flow too — not just ones made via
    // a public booking widget. Idempotent via the same id (not enforced by
    // a unique constraint, but the meeting flow only fires once per slot).
    try {
      const { data: biz } = await supabase
        .from('omni_businesses')
        .select('slug')
        .eq('id', business_id)
        .maybeSingle();
      const slug = biz?.slug?.toLowerCase();
      if (slug && ['cps','youngs','leifson','ltb','prime_iv','otd','phoenix','niki','alira','omnileads'].includes(slug)) {
        // The inbound_<slug>_bookings tables enforce NOT NULL on services
        // (jsonb) and total_estimate (int). Default both so agentic-flow
        // bookings (which don't carry a services list) still mirror cleanly.
        await supabase.from(`inbound_${slug}_bookings`).insert({
          business_id,
          lead_id: lead_id ?? null,
          attendee_name,
          attendee_email,
          attendee_phone: attendee_phone ?? null,
          attendee_notes: attendee_notes ?? null,
          services: [],
          total_estimate: 0,
          start_at,
          status: 'confirmed',
        });
      }
    } catch (e) {
      console.error('[meetings/book] inbound mirror failed:', e);
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

// DELETE — cancel a meeting (soft: status=cancelled, keeps audit trail).
// Also sends a cancellation email to the attendee with a reschedule link.
// Pass ?notify=0 to skip the email (e.g. silent cancel from CLI).
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hard = searchParams.get('hard') === '1';
    const notify = searchParams.get('notify') !== '0';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Fetch the booking BEFORE we mutate so we have attendee details for the
    // email even on hard-delete.
    const { data: booking } = await supabase
      .from('omni_meeting_bookings')
      .select('id, attendee_name, attendee_email, start_at, duration_minutes, meeting_type')
      .eq('id', id)
      .single();

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

    // Fire-and-forget cancellation email + Telegram ping. Failures don't roll
    // back the cancellation — they get logged and the user retries notify if
    // needed.
    if (notify && booking?.attendee_email && process.env.RESEND_API_KEY) {
      sendCancellationEmail(booking).catch(err =>
        console.error('[meetings/book DELETE] cancellation email failed:', err)
      );
    }
    if (notify && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID && booking) {
      const dt = new Date(booking.start_at).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'Markdown',
          text: `❌ *Meeting cancelled*\n\n*${booking.attendee_name}*\n${booking.attendee_email}\n\n🕐 ${dt}`,
        }),
      }).catch(() => {});
    }

    // Audit log
    if (booking) {
      supabase.from("omni_admin_audit_log").insert({
        actor: "admin",
        action: hard ? "meeting_deleted" : "meeting_cancelled",
        target_type: "meeting",
        target_id: id,
        metadata: {
          attendee_name: booking.attendee_name,
          attendee_email: booking.attendee_email,
          start_at: booking.start_at,
          notify,
        },
      }).then(() => {});
    }

    return NextResponse.json({ ok: true, emailed: notify && !!booking?.attendee_email });
  } catch (err) {
    console.error('[meetings/book DELETE]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

async function sendCancellationEmail(b: {
  attendee_name: string;
  attendee_email: string;
  start_at: string;
  duration_minutes: number;
  meeting_type: string | null;
}) {
  const startDate = new Date(b.start_at);
  const dateFormatted = startDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeFormatted = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  const isStrategyCall = (b.meeting_type ?? 'strategy_call') === 'strategy_call';
  const meetingLabel = isStrategyCall ? 'strategy call' : 'demo';
  const rescheduleUrl = 'https://omnileadsagi.com/book-now';
  const homeUrl = 'https://omnileadsagi.com';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
        <td align="right" style="color:#f87171;font-size:12px;font-weight:600;letter-spacing:1px;">CANCELLED</td>
      </tr>
    </table>

    <div style="margin-bottom:28px;">
      <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">
        Your ${meetingLabel} has been cancelled.
      </h1>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0;">
        Hi ${b.attendee_name.split(' ')[0] || 'there'} — we're cancelling the ${meetingLabel} we had on the books.
        No worries; you can grab a new time below.
      </p>
    </div>

    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #f87171;border-radius:8px;padding:20px;margin-bottom:28px;">
      <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Was scheduled for</p>
      <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">${dateFormatted}</p>
      <p style="color:#d1d5db;font-size:13px;margin:4px 0 0;">${timeFormatted} CT &middot; ${b.duration_minutes} min</p>
    </div>

    <div style="text-align:center;margin:28px 0 16px;">
      <a href="${rescheduleUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:700;">
        Reschedule your ${meetingLabel}
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center;margin:0 0 28px;">
      Or visit <a href="${homeUrl}" style="color:#a855f7;text-decoration:none;">omnileadsagi.com</a> to learn more first.
    </p>

    <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
      <p style="color:#4b5563;font-size:11px;margin:0;">
        Questions? Reply to this email — it goes straight to us.
      </p>
      <p style="color:#4b5563;font-size:11px;margin:6px 0 0;">
        Omni AI &middot; <a href="${homeUrl}" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Omni AI <bookings@omnileadsagi.com>',
      to: [b.attendee_email],
      reply_to: 'sitanim8@gmail.com',
      subject: `Your ${isStrategyCall ? 'Strategy Call' : 'Demo'} on ${dateFormatted} has been cancelled`,
      html,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText.slice(0, 200)}`);
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateICS, parseBookingDateTime, buildGoogleCalendarUrl } from '@/lib/calendar-utils';
import { bookerConfirmationEmail, ownerNotificationEmail } from '@/lib/email-templates';
import { logEvent } from '@/lib/events';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = 'sitanim8@gmail.com';
const OWNER_NAME = 'Omni AI';
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

// ── GET: Fetch all bookings + webinar registrations ─────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    const [bookingsRes, trainingsRes] = await Promise.all([
      supabase
        .from('demo_bookings')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('webinar_registrations')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (bookingsRes.error) throw bookingsRes.error;

    const bookings = (bookingsRes.data || []).map((b: any) => ({
      id: b.id,
      name: b.name || b.businessName || 'Demo',
      email: b.email,
      phone: b.phone || '',
      date: b.date,
      time: b.time,
      type: 'demo' as const,
      createdAt: b.created_at || b.createdAt,
    }));

    const trainings = (trainingsRes.data || []).map((t: any) => ({
      id: t.id,
      name: `${t.firstName || t.first_name || ''} ${t.lastName || t.last_name || ''}`.trim() || 'Training',
      email: t.email,
      phone: t.phone || '',
      date: t.sessionDate || t.session_date || '',
      time: t.sessionTime || t.session_time || '',
      type: 'training' as const,
      createdAt: t.created_at || t.createdAt,
    }));

    const all = [...bookings, ...trainings].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`).getTime() || 0;
      const dateB = new Date(`${b.date} ${b.time}`).getTime() || 0;
      return dateA - dateB;
    });

    return NextResponse.json({ bookings: all });
  } catch (error) {
    console.error('Error fetching meetings & events:', error);
    return NextResponse.json({ bookings: [] }, { status: 500 });
  }
}

// ── POST: Create booking + send emails + calendar ───────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Use admin client (service role) to bypass RLS
    const supabase = createAdminClient();

    const row = {
      name: body.name || '',
      phone: body.phone || '',
      email: body.email || '',
      business_name: body.businessName || body.business_name || '',
      purpose: body.purpose || '',
      date: body.date || '',
      time: body.time || '',
    };

    // 1. Save to database
    const { data, error } = await supabase
      .from('demo_bookings')
      .insert([row])
      .select()
      .single();

    if (error) {
      // Log raw Supabase error server-side only; don't leak schema details.
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: "We couldn't book your demo. Please try again." },
        { status: 400 },
      );
    }

    // 2. Parse meeting times
    const startDate = parseBookingDateTime(row.date, row.time);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour meeting

    // Format date for display
    const dateObj = new Date(row.date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // 3. Generate .ics calendar invite
    const eventUid = `demo-${data.id}@omnileadsagi.com`;
    const icsContent = generateICS({
      summary: `Omni AI Demo — ${row.name}`,
      description: `Demo with ${row.name} from ${row.business_name || 'N/A'}\\nPurpose: ${row.purpose}\\nEmail: ${row.email}\\nPhone: ${row.phone}`,
      startDate,
      endDate,
      organizerName: OWNER_NAME,
      organizerEmail: OWNER_EMAIL,
      attendeeName: row.name,
      attendeeEmail: row.email,
      uid: eventUid,
    });

    // 4. Build Google Calendar URL
    const googleCalUrl = buildGoogleCalendarUrl({
      title: `Omni AI Demo — ${row.name}`,
      description: `Demo with ${row.name}\nBusiness: ${row.business_name || 'N/A'}\nPurpose: ${row.purpose}\nEmail: ${row.email}\nPhone: ${row.phone}`,
      startDate,
      endDate,
    });

    const bookingDetails = {
      name: row.name,
      email: row.email,
      phone: row.phone,
      businessName: row.business_name,
      purpose: row.purpose,
      dateFormatted,
      time: row.time,
      googleCalendarUrl: googleCalUrl,
    };

    // 5. Send emails in parallel (fire-and-forget for speed, but log errors)
    const icsBase64 = Buffer.from(icsContent).toString('base64');

    const emailPromises = [];

    if (RESEND_API_KEY) {
      // Send confirmation to the booker
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: row.email,
          subject: `Demo Confirmed — ${dateFormatted} at ${row.time} CT`,
          html: bookerConfirmationEmail(bookingDetails),
          attachments: [{
            filename: 'omni-ai-demo.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST',
          }],
        }).catch(err => console.error('Failed to send booker email:', err))
      );

      // Send notification to the owner
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: OWNER_EMAIL,
          subject: `New Demo Booked: ${row.name} — ${dateFormatted} at ${row.time}`,
          html: ownerNotificationEmail(bookingDetails),
          attachments: [{
            filename: 'omni-ai-demo.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST',
          }],
        }).catch(err => console.error('Failed to send owner email:', err))
      );
    } else {
      console.warn('RESEND_API_KEY not set — skipping emails');
    }

    // Wait for emails (don't block response for too long)
    await Promise.allSettled(emailPromises);

    // 6. Log event (fire-and-forget)
    logEvent(supabase as any, {
      actor_type: 'user',
      actor_id: row.email || 'anonymous',
      event_type: 'lead_created',
      event_category: 'crm',
      action: 'create',
      target_type: 'demo_booking',
      target_id: data?.id,
      value_text: row.business_name || row.name || '',
      properties: {
        email: row.email,
        purpose: row.purpose,
        date: row.date,
        time: row.time,
      },
    });

    return NextResponse.json({
      ...data,
      googleCalendarUrl: googleCalUrl,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating demo booking:', error);
    return NextResponse.json({ error: 'Failed to create demo booking' }, { status: 500 });
  }
}

// ── Resend Email Helper ─────────────────────────────────────────────────────

async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string; content_type: string }[];
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errText}`);
  }

  const result = await res.json();
  console.log(`Email sent to ${params.to}: ${result.id}`);
  return result;
}

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateICS, parseBookingDateTime, buildGoogleCalendarUrl } from '@/lib/calendar-utils';
import { bookerConfirmationEmail, ownerNotificationEmail } from '@/lib/email-templates';
import { logEvent } from '@/lib/events';
import { notifyBooking } from '@/lib/agi/telegram';
import {
  isValidEmail,
  escapeHtml,
  isBotSubmission,
  sanitizeText,
} from '@/lib/validation';
import {
rateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit';

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = 'sitanim8@gmail.com';
const OWNER_NAME = 'Omni AI';
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

// ── GET: Fetch all bookings + webinar registrations ─────────────────────────

export async function GET() {
  noStore();
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
    // Rate-limit FIRST. Demo-booking fires two Resend emails + an .ics
    // attachment per successful POST — the single most expensive public
    // endpoint we have. 2 per 10 min per IP: users don't double-book,
    // and the "meant to click once but clicked twice" race is inside
    // that budget.
    const ip = getClientIp(request.headers);
    const rl = rateLimit(`demo-booking:${ip}`, 2, 10 * 60 * 1000);
    if (!rl.ok) return rateLimitResponse(rl.resetMs);

    const body = await request.json();

    // Bot check — honeypot field. Spambots auto-fill every input; real
    // users never see it. Silent 200 OK (not 4xx) so the bot thinks the
    // submission succeeded and doesn't retry with a different field name.
    if (isBotSubmission(body)) {
      return NextResponse.json({ success: true });
    }

    // Use admin client (service role) to bypass RLS
    const supabase = createAdminClient();

    // Sanitize + length-cap every free-text field before it touches the
    // DB or an email template. Previously these were passed raw all the
    // way through to Resend, so a `name` of `<img src=x onerror=...>`
    // would render live in the owner's inbox (our own eyeballs) and in
    // the booker confirmation.
    const row = {
      name: sanitizeText(body.name, 200),
      phone: sanitizeText(body.phone, 50),
      email: sanitizeText(body.email, 254),
      business_name: sanitizeText(body.businessName || body.business_name, 200),
      purpose: sanitizeText(body.purpose, 1000),
      date: sanitizeText(body.date, 20),
      time: sanitizeText(body.time, 20),
    };

    // Validate email format server-side. The form caller already checks
    // client-side but a direct POST (curl, scripted abuse) would sail
    // through presence-only validation and get an arbitrary email sent
    // from our branded sender.
    if (row.email && !isValidEmail(row.email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }
    row.email = row.email.toLowerCase();

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

    // 1b. Telegram notification (fire-and-forget). The Postgres trigger
    // omni_ai_trg_demo_to_meeting will mirror this row into omni_meeting_bookings
    // for the agentic dashboard's Meetings tab — this fires the push to phone.
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const startISO = (() => {
        try { return parseBookingDateTime(row.date, row.time).toISOString(); }
        catch { return new Date().toISOString(); }
      })();
      notifyBooking({
        attendeeName: row.name || 'Demo',
        attendeeEmail: row.email,
        start_at: startISO,
      }).catch(err => console.error('Telegram booking notify failed:', err));
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
    // /book-now is a free Strategy Call (not a product demo). The legacy
    // `demo_bookings` table name is kept intact per request — only the
    // user-facing labels change.
    const eventUid = `strategy-${data.id}@omnileadsagi.com`;
    const icsContent = generateICS({
      summary: `Omni AI Strategy Call — ${row.name}`,
      description: `Strategy Call with ${row.name} from ${row.business_name || 'N/A'}\\nFocus: ${row.purpose}\\nEmail: ${row.email}\\nPhone: ${row.phone}`,
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
      title: `Omni AI Strategy Call — ${row.name}`,
      description: `Strategy Call with ${row.name}\nBusiness: ${row.business_name || 'N/A'}\nFocus: ${row.purpose}\nEmail: ${row.email}\nPhone: ${row.phone}`,
      startDate,
      endDate,
    });

    // Escape the values that flow into the email templates before we
    // hand them off. `lib/email-templates.ts` uses raw ${...} interpolation
    // — encoding here is what keeps `<script>` out of the rendered HTML.
    // Values we generate ourselves (dateFormatted, googleCalendarUrl, time
    // which is "3:00 PM" format) are safe as-is.
    const bookingDetails = {
      name: escapeHtml(row.name),
      email: escapeHtml(row.email),
      phone: escapeHtml(row.phone),
      businessName: escapeHtml(row.business_name),
      purpose: escapeHtml(row.purpose),
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
          subject: `Strategy Call Confirmed — ${dateFormatted} at ${row.time} CT`,
          html: bookerConfirmationEmail(bookingDetails),
          attachments: [{
            filename: 'omni-ai-strategy-call.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST',
          }],
        }).catch(err => console.error('Failed to send booker email:', err))
      );

      // Send notification to the owner — replyTo is the booker's email
      // so hitting Reply in any mail client responds to the booker
      // directly, instead of the bookings@ inbox we send from.
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: OWNER_EMAIL,
          replyTo: row.email,
          subject: `New Strategy Call Booked: ${row.name} — ${dateFormatted} at ${row.time}`,
          html: ownerNotificationEmail(bookingDetails),
          attachments: [{
            filename: 'omni-ai-strategy-call.ics',
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
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string; content_type: string }[];
}) {
  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  };
  if (params.replyTo) body.reply_to = params.replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errText}`);
  }

  const result = await res.json();
  console.log(`Email sent to ${params.to}: ${result.id}`);
  return result;
}

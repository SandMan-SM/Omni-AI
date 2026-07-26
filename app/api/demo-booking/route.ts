import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parseBookingDateTime, buildGoogleCalendarUrl } from '@/lib/calendar-utils';
import { persistBookingSubmission } from '@/lib/server/direct-postgres';
import {
  isValidEmail,
  isBotSubmission,
  sanitizeText,
  escapeHtml,
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
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

// Owner notification for a booked strategy call. The booking persists above
// regardless; this tells the owner it happened. Without it, /book-now
// consultations landed silently in the DB (the endpoint's own comment claimed
// it sent two emails, but that code was gone — a silent-lead-miss). Best-effort
// with a bounded retry (same idempotency key → Resend dedupes a slow success,
// never double-sends); NEVER throws, so an email hiccup can't fail the booking.
async function notifyOwnerOfBooking(input: {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  purpose: string;
  date: string;
  time: string;
  googleCalUrl: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[demo-booking] RESEND_API_KEY not set — booking saved, owner not notified');
    return false;
  }
  const nameEsc = escapeHtml(input.name || 'Prospect');
  const emailEsc = escapeHtml(input.email);
  const phoneEsc = escapeHtml(input.phone || '—');
  const bizEsc = escapeHtml(input.businessName || '—');
  const purposeEsc = escapeHtml(input.purpose || '—');
  const whenEsc = escapeHtml(`${input.date} · ${input.time}`);
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;">
  <h2 style="margin-bottom:4px;">New strategy call booked</h2>
  <p style="color:#555;margin-top:0;">Booked via <a href="https://omnileadsagi.com/book-now" style="color:#6366f1;">omnileadsagi.com/book-now</a>.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:20px;">
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;width:140px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${nameEsc}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;"><a href="mailto:${emailEsc}" style="color:#6366f1;">${emailEsc}</a></td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${phoneEsc}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Business</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${bizEsc}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Focus</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${purposeEsc}</td></tr>
    <tr><td style="padding:10px 0;font-weight:600;">Requested time</td><td style="padding:10px 0;">${whenEsc}</td></tr>
  </table>
  <p style="margin-top:24px;"><a href="${escapeHtml(input.googleCalUrl)}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Add to Google Calendar</a></p>
</div>`;
  const text = [
    'NEW STRATEGY CALL BOOKED',
    `Name:     ${input.name}`,
    `Email:    ${input.email}`,
    `Phone:    ${input.phone || '—'}`,
    `Business: ${input.businessName || '—'}`,
    `Focus:    ${input.purpose || '—'}`,
    `When:     ${input.date} · ${input.time}`,
    `Calendar: ${input.googleCalUrl}`,
  ].join('\n');

  const backoffs = [0, 600, 1800];
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    if (backoffs[attempt]) await new Promise((r) => setTimeout(r, backoffs[attempt]));
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `demo-booking-owner-${input.id}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [OWNER_EMAIL],
          reply_to: input.email || undefined,
          subject: `New strategy call: ${input.name || 'Prospect'} — ${input.date} ${input.time}`,
          html,
          text,
        }),
      });
      if (res.ok) return true;
      const bodyText = await res.text().catch(() => '<no body>');
      console.error(`[demo-booking] owner notify attempt ${attempt + 1} — resend ${res.status}: ${bodyText.slice(0, 200)}`);
    } catch (err) {
      console.error(`[demo-booking] owner notify attempt ${attempt + 1} failed`, err);
    }
  }
  console.error('[demo-booking] owner notification not sent after retries — booking saved; follow up in CRM', input.id);
  return false;
}

// ── GET: Fetch all bookings + webinar registrations ─────────────────────────

export async function GET() {
  noStore();
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

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
    const debugPersistence = new URL(request.url).searchParams.get('debug') === '1';

    // Bot check — honeypot field. Spambots auto-fill every input; real
    // users never see it. Silent 200 OK (not 4xx) so the bot thinks the
    // submission succeeded and doesn't retry with a different field name.
    if (isBotSubmission(body)) {
      return NextResponse.json({ success: true });
    }

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

    // 1. Parse meeting times
    const startDate = parseBookingDateTime(row.date, row.time);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour meeting

    const sourceRecordId = randomUUID();
    const persistence = await persistBookingSubmission({
      id: sourceRecordId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      businessName: row.business_name,
      purpose: row.purpose,
      date: row.date,
      time: row.time,
      scheduledAt: startDate.toISOString(),
      raw: body,
    });

    // 2. Build Google Calendar URL. Keep the public booking endpoint
    // focused on the work the visitor is waiting for: a confirmed slot
    // response + calendar URL. Supabase writes are degraded right now,
    // and starting slow fetches here traps the browser in a spinner.
    const googleCalUrl = buildGoogleCalendarUrl({
      title: `Omni AI Strategy Call — ${row.name}`,
      description: `Strategy Call with ${row.name}\nBusiness: ${row.business_name || 'N/A'}\nFocus: ${row.purpose}\nEmail: ${row.email}\nPhone: ${row.phone}`,
      startDate,
      endDate,
    });

    console.info('[demo-booking] captured booking request', {
      id: sourceRecordId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      date: row.date,
      time: row.time,
      purpose: row.purpose,
      crmStatus: persistence.crmStatus,
    });

    // Notify the owner. Guarded + retrying internally; never throws, so it
    // cannot fail the captured booking or the 201 below.
    const ownerNotified = await notifyOwnerOfBooking({
      id: sourceRecordId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      businessName: row.business_name,
      purpose: row.purpose,
      date: row.date,
      time: row.time,
      googleCalUrl,
    });

    return NextResponse.json({
      ownerNotified,
      id: sourceRecordId,
      leadId: persistence.leadId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      date: row.date,
      time: row.time,
      scheduled_at: startDate.toISOString(),
      persisted: persistence.persisted,
      crmStatus: persistence.crmStatus,
      ...(debugPersistence
        ? { persistenceDebug: { status: persistence.crmStatus, persisted: persistence.persisted } }
        : {}),
      googleCalendarUrl: googleCalUrl,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating demo booking:', error);
    return NextResponse.json({ error: 'Failed to create demo booking' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { parseBookingDateTime, buildGoogleCalendarUrl } from '@/lib/calendar-utils';
import { persistBookingSubmission } from '@/lib/server/direct-postgres';
import {
  isValidEmail,
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

    return NextResponse.json({
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
      googleCalendarUrl: googleCalUrl,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating demo booking:', error);
    return NextResponse.json({ error: 'Failed to create demo booking' }, { status: 500 });
  }
}

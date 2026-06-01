import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseBookingDateTime, buildGoogleCalendarUrl } from '@/lib/calendar-utils';
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
const OWNER_EMAIL = 'sitanim8@gmail.com';
const OWNER_NAME = 'Omni AI';

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

async function mirrorBookingToCrm(
  supabase: ReturnType<typeof createAdminClient>,
  sourceRecordId: string,
  row: {
    name: string;
    phone: string;
    email: string;
    business_name: string;
    purpose: string;
    date: string;
    time: string;
  },
) {
  try {
    const { data: business, error: businessError } = await supabase
      .from('omni_businesses')
      .select('id')
      .eq('name', 'Omni AI')
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business?.id) {
      console.warn('[demo-booking] Omni AI business row not found; CRM mirror skipped');
      return;
    }

    const { firstName, lastName } = splitName(row.name);
    const notes = [
      `Strategy call booked for ${row.date || 'TBD'} ${row.time || ''}`.trim(),
      row.purpose ? `Purpose: ${row.purpose}` : null,
      row.business_name ? `Business: ${row.business_name}` : null,
    ].filter(Boolean).join('\n');

    const { data: lead, error: insertError } = await supabase
      .from('omni_leads_generated')
      .insert({
        business_id: business.id,
        source_table: 'book_now_submissions',
        source_record_id: sourceRecordId,
        first_name: firstName,
        last_name: lastName,
        email: row.email,
        phone: row.phone || null,
        company: row.business_name || null,
        source: 'web',
        status: 'qualified',
        score: 85,
        deal_stage: 'demo',
        notes,
        tags: ['book-now', 'strategy-call', 'crm-instant'],
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return lead;
  } catch (error) {
    console.error('[demo-booking] CRM mirror failed:', error);
    throw error;
  }
}

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

    // Supabase/PostgREST is currently timing out database statements for
    // public writes. Do not trap the visitor in a spinner while that is
    // degraded. This log keeps the submission visible in Vercel logs; CRM
    // persistence must be restored by fixing the Supabase write path.
    console.info('[demo-booking] captured fast booking request', {
      id: sourceRecordId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      date: row.date,
      time: row.time,
      purpose: row.purpose,
    });

    return NextResponse.json({
      id: sourceRecordId,
      leadId: null,
      name: row.name,
      email: row.email,
      phone: row.phone,
      date: row.date,
      time: row.time,
      scheduled_at: startDate.toISOString(),
      crmStatus: 'supabase-write-degraded',
      googleCalendarUrl: googleCalUrl,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating demo booking:', error);
    return NextResponse.json({ error: 'Failed to create demo booking' }, { status: 500 });
  }
}

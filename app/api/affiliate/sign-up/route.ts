import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

const OWNER_EMAIL = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

// POST /api/affiliate/sign-up
//
// Historical context:
//   This route used to insert into `affiliate_signups` — a table that
//   doesn't exist. The previous code swallowed Postgres error code
//   42P01 (relation does not exist) and relied on the Resend
//   notification alone. Every sign-up was saved only in an email inbox,
//   with no CRM row to follow up from.
//
// Fix:
//   Write to the real `leads` table with source='affiliate_signup' so
//   entries are searchable from the admin CRM alongside other captures.
//   Audience context goes into notes. Resend notification is preserved.
//
// Cycle 26 hardening (parallel to book-consultation):
//   - Bot-honeypot silent 200
//   - sanitizeText + length caps
//   - escapeHtml on every email interpolation site
export async function POST(request: Request) {
  // Rate-limit FIRST, before JSON parse. 3 per 10 min per IP.
  const ip = getClientIp(request.headers);
  const rl = rateLimit(`affiliate-signup:${ip}`, 3, 10 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (isBotSubmission(body)) {
    return NextResponse.json({ success: true });
  }

  const name = sanitizeText(body.name, 200);
  const emailRaw = sanitizeText(body.email, 254);
  const phone = sanitizeText(body.phone, 50);
  const audience = sanitizeText(body.audience, 1000);

  if (!name || !emailRaw || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!isValidEmail(emailRaw)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    );
  }
  const email = emailRaw.toLowerCase();

  const sb = createAdminClient();
  const { error } = await sb.from('leads').insert({
    full_name: name,
    email,
    phone,
    notes: audience ? `audience: ${audience}` : null,
    source: 'affiliate_signup',
  });

  if (error) {
    console.error('[affiliate/sign-up] DB insert error:', error);
    // Don't block the email notification — still pings the owner so
    // the lead isn't dropped even if the DB write is temporarily broken.
  }

  if (RESEND_API_KEY) {
    const nameEsc = escapeHtml(name);
    const emailEsc = escapeHtml(email);
    const phoneEsc = escapeHtml(phone);
    const audienceEsc = escapeHtml(audience) || '&mdash;';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `New affiliate signup: ${name}`,
        html: `<h2>New affiliate signup</h2>
<p><strong>Name:</strong> ${nameEsc}</p>
<p><strong>Email:</strong> ${emailEsc}</p>
<p><strong>Phone:</strong> ${phoneEsc}</p>
<p><strong>Audience:</strong> ${audienceEsc}</p>`,
      }),
    }).catch((e) => console.error('[affiliate/sign-up] Email error:', e));
  }

  return NextResponse.json({ success: true });
}

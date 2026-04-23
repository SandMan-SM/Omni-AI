import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isValidEmail,
  escapeHtml,
  isBotSubmission,
  sanitizeText,
} from '@/lib/validation';

const OWNER_EMAIL = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

// POST /api/affiliate/book-consultation
//
// Historical context:
//   Originally targeted `affiliate_consultations` — a table that doesn't
//   exist in this project. Previous code swallowed Postgres 42P01 and
//   relied on a Resend notification alone, so every consultation request
//   lived only in an email inbox with no CRM follow-up row. The raw
//   `error.message` was also leaking to the client in the catch branch.
//
// Fix:
//   Write to `leads` with source='affiliate_consultation'. Goal goes into
//   notes. Generic error copy. Resend notification preserved.
//
// Cycle 26 hardening:
//   - Bot-honeypot check (silent 200 on non-empty)
//   - sanitizeText + length caps on every free-text field
//   - escapeHtml on every value interpolated into the notification email
//     (name/email/phone/goal flowed raw into HTML before — XSS into our
//     own inbox)
export async function POST(request: Request) {
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
  const goal = sanitizeText(body.goal, 1000);

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
    notes: goal ? `goal: ${goal}` : null,
    source: 'affiliate_consultation',
  });

  if (error) {
    console.error('[affiliate/book-consultation] DB insert error:', error);
    // Continue — still fire the Resend notification so the lead isn't
    // dropped if the DB write is temporarily broken.
  }

  if (RESEND_API_KEY) {
    const nameEsc = escapeHtml(name);
    const emailEsc = escapeHtml(email);
    const phoneEsc = escapeHtml(phone);
    const goalEsc = escapeHtml(goal) || '&mdash;';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `Affiliate consultation request: ${name}`,
        html: `<h2>New affiliate consultation request</h2>
<p><strong>Name:</strong> ${nameEsc}</p>
<p><strong>Email:</strong> ${emailEsc}</p>
<p><strong>Phone:</strong> ${phoneEsc}</p>
<p><strong>Goal:</strong> ${goalEsc}</p>`,
      }),
    }).catch((e) => console.error('[affiliate/book-consultation] Email error:', e));
  }

  return NextResponse.json({ success: true });
}

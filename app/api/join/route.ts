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
import { HOUSE_LEAD_FROM } from '@/lib/lead-sender';

const OWNER_EMAIL = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = HOUSE_LEAD_FROM;

// POST /api/join
//
// Account-request intake for /join.
//
// The /join form used to call lib/auth.ts `createLead()`, which wrote to
// the `leads` table from the browser with the anon key. Two things were
// broken with that: the `leads` table is service_role_all so the write
// was rejected by RLS, and the column names it used (`name`, `status`)
// do not exist on the table at all — the real columns are `full_name`,
// `email`, `phone`. Every account request failed with an opaque error
// and nothing was ever captured.
//
// This route writes the row on the service-role client with the correct
// columns, so the request is searchable in the admin CRM, and emails the
// owner so it is not missed.
export async function POST(request: Request) {
  // Rate-limit FIRST, before JSON parse. 3 per 10 min per IP.
  const ip = getClientIp(request.headers);
  const rl = rateLimit(`join:${ip}`, 3, 10 * 60 * 1000);
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
    notes: 'Account request from /join — admin to provision login.',
    source: 'website_join',
  });

  if (error) {
    console.error('[join] DB insert error:', error);
    return NextResponse.json(
      { error: 'Could not submit your request. Please try again.' },
      { status: 500 },
    );
  }

  if (RESEND_API_KEY) {
    const nameEsc = escapeHtml(name);
    const emailEsc = escapeHtml(email);
    const phoneEsc = escapeHtml(phone);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [OWNER_EMAIL],
          reply_to: email,
          subject: `New account request: ${name}`,
          html: `<h2>New account request</h2>
<p><strong>Name:</strong> ${nameEsc}</p>
<p><strong>Email:</strong> ${emailEsc}</p>
<p><strong>Phone:</strong> ${phoneEsc}</p>
<p>Provision a login from the admin CRM.</p>`,
        }),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '<no body>');
        console.error(`[join] resend ${res.status}: ${bodyText.slice(0, 300)}`);
      }
    } catch (e) {
      console.error('[join] Email error:', e);
    }
  }

  return NextResponse.json({ success: true });
}

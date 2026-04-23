import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail, isBotSubmission, sanitizeText } from '@/lib/validation';
import {
  rateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit';

// POST /api/waitlist — generic lead capture endpoint.
//
// Historical context:
//   This route originally targeted a `waitlist_entries` table that never
//   actually shipped. Every caller (currently just /sponsor/application)
//   was silently failing in production — the POST 500'd, the client-side
//   catch swallowed the error, and the user saw a fake "submitted" state.
//   Meanwhile /api/waitlist GET 500'd on every admin dashboard load.
//
// Fix:
//   Retarget the public `leads` table (RLS allows anon inserts; we use
//   the service-role client here for consistency with /api/newsletter).
//   Map the legacy payload shape to the real columns. GET is retired —
//   it had no callers and its only job was to 500.
//
// Column mapping (legacy payload → leads):
//   name           → full_name
//   email          → email
//   phone          → phone
//   message        → notes  (appended to role/source context)
//   available_date → selected_date (DATE)
//   source         → source  (e.g., "sponsor_application")
//   role           → folded into notes
export async function POST(request: Request) {
  // Rate-limit FIRST. Writes directly to `leads` table — unbounded,
  // row-level flooding if left open. 3 per 10 min per IP.
  const ip = getClientIp(request.headers);
  const rl = rateLimit(`waitlist:${ip}`, 3, 10 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Honeypot — silent 200 so bots don't retry.
  if (isBotSubmission(body)) {
    return NextResponse.json({ success: true });
  }

  // sanitizeText + per-field caps. Previously `message` was unbounded;
  // a malicious POST could jam 1MB of garbage into `notes` every time.
  const name = sanitizeText(body.name, 200);
  const emailInput = sanitizeText(body.email, 254);
  const phone = sanitizeText(body.phone, 50);
  const message = sanitizeText(body.message, 2000);
  const availableDate = typeof body.available_date === 'string' ? body.available_date : null;
  const source = sanitizeText(body.source, 100) || 'waitlist';
  const role = sanitizeText(body.role, 100) || null;

  if (!name || !emailInput || !phone) {
    return NextResponse.json(
      { error: 'name, email, and phone are required.' },
      { status: 400 },
    );
  }
  if (!isValidEmail(emailInput)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 },
    );
  }
  const email = emailInput.toLowerCase();

  // Compose a single notes blob so we don't lose the role + message
  // context. The `leads` table doesn't have dedicated columns for those
  // but the CRM views surface `notes` directly.
  const notesParts: string[] = [];
  if (role) notesParts.push(`role: ${role}`);
  if (message) notesParts.push(message);
  const notes = notesParts.join('\n\n') || null;

  const admin = createAdminClient();

  // Selected_date must be either a YYYY-MM-DD string or null — reject
  // anything else so Postgres doesn't throw a cryptic date-parse error.
  const selectedDate =
    availableDate && /^\d{4}-\d{2}-\d{2}$/.test(availableDate) ? availableDate : null;

  const { data, error } = await admin
    .from('leads')
    .insert({
      full_name: name,
      email,
      phone,
      notes,
      selected_date: selectedDate,
      source,
    })
    .select('id, email, source, created_at')
    .single();

  if (error) {
    console.error('waitlist (leads) insert error:', error);
    return NextResponse.json(
      { error: "We couldn't save your submission. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { id: data?.id, email: data?.email, source: data?.source },
    { status: 201 },
  );
}

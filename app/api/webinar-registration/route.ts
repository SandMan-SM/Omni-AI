import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateICS, parseBookingDateTime } from '@/lib/calendar-utils';
import { logEvent } from '@/lib/events';
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
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

export async function GET() {
  noStore();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('webinar_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching webinar registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Rate-limit FIRST. Like demo-booking, this route sends two Resend
    // emails + an .ics per successful POST. 2 per 10 min per IP.
    const ip = getClientIp(request.headers);
    const rl = rateLimit(`webinar-registration:${ip}`, 2, 10 * 60 * 1000);
    if (!rl.ok) return rateLimitResponse(rl.resetMs);

    const body = await request.json();

    // Bot check — silent 200 so the bot doesn't retry with a different
    // field name. See `/api/landing-lead` for the full rationale.
    if (isBotSubmission(body)) {
      return NextResponse.json({ success: true });
    }

    const supabase = createAdminClient();

    // Sanitize + cap every free-text field. Previously these flowed raw
    // into the owner + registrant emails, allowing HTML injection via
    // name/phone/email into both our inbox and the registrant's.
    const row = {
      first_name: sanitizeText(body.firstName || body.first_name, 100),
      last_name: sanitizeText(body.lastName || body.last_name, 100),
      email: sanitizeText(body.email, 254),
      phone: sanitizeText(body.phone, 50),
      session_date: sanitizeText(body.sessionDate || body.session_date, 20),
      session_time: sanitizeText(body.sessionTime || body.session_time, 20),
    };

    // Server-side email validation — blocks arbitrary-address abuse of
    // our branded sender via direct POST.
    if (row.email && !isValidEmail(row.email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }
    row.email = row.email.toLowerCase();

    const { data, error } = await supabase
      .from('webinar_registrations')
      .insert([row])
      .select()
      .single();

    if (error) {
      // Log raw Supabase error (schema, constraint, hint) server-side only.
      // Returning error.message leaks DB structure.
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: "We couldn't save your registration. Please try again." },
        { status: 400 },
      );
    }

    // Parse session date/time for calendar
    const startDate = parseBookingDateTime(row.session_date, row.session_time);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const fullName = `${row.first_name} ${row.last_name}`.trim();

    // Format date for display
    const dateObj = new Date(row.session_date + 'T12:00:00');
    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Generate .ics
    const icsContent = generateICS({
      summary: 'Omni AI Training Session',
      description: `Free AI CEO Training with ${fullName}\\nYour Own Private AI CEO Will Run Your Business While You Sleep!\\n\\nHosted by Omni AI\\nhttps://omnileadsagi.com`,
      startDate,
      endDate,
      organizerName: 'Omni AI',
      organizerEmail: OWNER_EMAIL,
      attendeeName: fullName,
      attendeeEmail: row.email,
      uid: `training-${data.id}@omnileadsagi.com`,
    });

    const icsBase64 = Buffer.from(icsContent).toString('base64');

    // Escape every user-controlled value before it flows into the email
    // HTML builders — those still use raw ${...} interpolation. Values
    // we compute ourselves (dateFormatted, icsBase64, session_time which
    // is "3:00 PM" format from a controlled picker) are safe as-is.
    const fullNameEsc = escapeHtml(fullName);
    const emailEsc = escapeHtml(row.email);
    const phoneEsc = escapeHtml(row.phone);

    // Send emails
    if (RESEND_API_KEY) {
      const emailPromises = [];

      // Confirmation email to registrant with free premium upgrade
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: row.email,
          subject: `You're In! Training Confirmed — ${dateFormatted} at ${row.session_time} CT`,
          html: buildRegistrantEmail({ name: fullNameEsc, dateFormatted, time: row.session_time }),
          attachments: [{
            filename: 'omni-ai-training.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST',
          }],
        }).catch(err => console.error('Failed to send registrant email:', err))
      );

      // Notification to owner — replyTo is the registrant's email so
      // the owner can hit Reply and respond directly to the registrant
      // instead of the bookings@ sender address.
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: OWNER_EMAIL,
          replyTo: row.email,
          subject: `New Training Registration: ${fullName} — ${dateFormatted} at ${row.session_time}`,
          html: buildOwnerEmail({ name: fullNameEsc, email: emailEsc, phone: phoneEsc, dateFormatted, time: row.session_time }),
          attachments: [{
            filename: 'omni-ai-training.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST',
          }],
        }).catch(err => console.error('Failed to send owner email:', err))
      );

      await Promise.allSettled(emailPromises);
    }

    // Log event
    logEvent(supabase as any, {
      actor_type: 'user',
      actor_id: row.email || 'anonymous',
      event_type: 'training_registered',
      event_category: 'crm',
      action: 'create',
      target_type: 'webinar_registration',
      target_id: data?.id,
      value_text: fullName,
      properties: { email: row.email, session_date: row.session_date, session_time: row.session_time },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating webinar registration:', error);
    return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 });
  }
}

// ── Email Helpers ───────────────────────────────────────────────────────────

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

function buildRegistrantEmail(p: { name: string; dateFormatted: string; time: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <!-- Top Bar -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
      <td align="right" style="color:#22c55e;font-size:12px;font-weight:600;letter-spacing:1px;">CONFIRMED</td>
    </tr>
  </table>

  <!-- Greeting -->
  <div style="margin-bottom:28px;">
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">You're in, ${p.name}.</h1>
    <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0;">
      Your seat for the free AI CEO training is reserved. Get ready to see how an autonomous AI can run your business while you sleep.
    </p>
  </div>

  <!-- Session Card -->
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:16px;">
    <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Your Session</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Date</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${p.dateFormatted}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Time</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${p.time} CT</td>
      </tr>
    </table>
  </div>

  <p style="color:#4b5563;font-size:12px;text-align:center;margin:0 0 28px;">
    A calendar invite (.ics) is attached to this email.
  </p>

  <!-- Free Premium Upgrade Section -->
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:28px;margin-bottom:28px;">
    <div style="text-align:center;margin-bottom:16px;">
      <span style="display:inline-block;background:#332800;color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:5px 14px;border-radius:20px;border:1px solid #4d3d00;">Free Upgrade</span>
    </div>
    <h3 style="color:#f59e0b;font-size:18px;text-align:center;margin:0 0 12px;font-weight:700;">You Just Unlocked Premium Access</h3>
    <p style="color:#9ca3af;font-size:14px;line-height:1.7;text-align:center;margin:0 0 24px;">
      Because you reserved your seat, you now have free access to our premium Interlinked newsletter. No extra steps needed.
    </p>

    <div style="background:#151515;border:1px solid #252525;border-radius:8px;padding:24px;margin-bottom:16px;">
      <p style="color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">The Revolution of AI</p>
      <p style="color:#d1d5db;font-size:14px;line-height:1.7;margin:0 0 14px;">
        Two businesses launched the same year, same market, same funding. One is thriving. The other is scrambling to survive. The difference wasn't talent or luck — it was timing. The ones who moved with AI didn't just adapt. They became untouchable.
      </p>
      <p style="color:#d1d5db;font-size:14px;line-height:1.7;margin:0 0 14px;">
        Right now, AI isn't replacing jobs — it's replacing entire business models. The companies that understand this aren't just surviving. They're building empires while their competitors are still debating whether to "try ChatGPT."
      </p>
      <p style="color:#d1d5db;font-size:14px;line-height:1.7;margin:0;">
        The question isn't whether AI will transform your industry. It already has. The only question is whether you'll be the one leading that transformation — or watching from the sideline.
      </p>
    </div>

    <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
      Premium insights delivered to your inbox — no action needed.
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
    <p style="color:#4b5563;font-size:11px;margin:0;">
      Omni AI &middot; Autonomous Intelligence &middot; <a href="https://omnileadsagi.com" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
    </p>
  </div>
</div>
</body></html>`;
}

function buildOwnerEmail(p: { name: string; email: string; phone: string; dateFormatted: string; time: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <!-- Top Bar -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
      <td align="right" style="color:#22c55e;font-size:12px;font-weight:600;letter-spacing:1px;">NEW REGISTRATION</td>
    </tr>
  </table>

  <!-- Header -->
  <div style="margin-bottom:28px;">
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">New Training Registration</h1>
    <p style="color:#6b7280;font-size:13px;margin:0;">Someone just signed up for the free AI CEO training.</p>
  </div>

  <!-- Contact Card -->
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:16px;">
    <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Contact</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Name</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${p.name}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Email</td>
        <td style="padding:8px 0;"><a href="mailto:${p.email}" style="color:#60a5fa;font-size:14px;text-decoration:none;">${p.email}</a></td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Phone</td>
        <td style="padding:8px 0;"><a href="tel:${p.phone}" style="color:#d1d5db;font-size:14px;text-decoration:none;">${p.phone}</a></td>
      </tr>
    </table>
  </div>

  <!-- Session Card -->
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:28px;">
    <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Session Details</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Date</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${p.dateFormatted}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Time</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${p.time} CT</td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
    <p style="color:#4b5563;font-size:11px;margin:0;">
      Omni AI &middot; <a href="https://omnileadsagi.com" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
    </p>
  </div>
</div>
</body></html>`;
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateICS, parseBookingDateTime } from '@/lib/calendar-utils';
import { logEvent } from '@/lib/events';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OWNER_EMAIL = 'sitanim8@gmail.com';
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

export async function GET() {
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
    const body = await request.json();
    const supabase = createAdminClient();

    const row = {
      first_name: body.firstName || body.first_name || '',
      last_name: body.lastName || body.last_name || '',
      email: body.email || '',
      phone: body.phone || '',
      session_date: body.sessionDate || body.session_date || '',
      session_time: body.sessionTime || body.session_time || '',
    };

    const { data, error } = await supabase
      .from('webinar_registrations')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
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

    // Send emails
    if (RESEND_API_KEY) {
      const emailPromises = [];

      // Confirmation email to registrant with free premium upgrade
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: row.email,
          subject: `You're In! Training Confirmed — ${dateFormatted} at ${row.session_time} CT`,
          html: buildRegistrantEmail({ name: fullName, dateFormatted, time: row.session_time }),
          attachments: [{
            filename: 'omni-ai-training.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST',
          }],
        }).catch(err => console.error('Failed to send registrant email:', err))
      );

      // Notification to owner
      emailPromises.push(
        sendEmail({
          from: FROM_EMAIL,
          to: OWNER_EMAIL,
          subject: `New Training Registration: ${fullName} — ${dateFormatted} at ${row.session_time}`,
          html: buildOwnerEmail({ name: fullName, email: row.email, phone: row.phone, dateFormatted, time: row.session_time }),
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

function buildRegistrantEmail(p: { name: string; dateFormatted: string; time: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#a855f7;font-size:28px;margin:0 0 8px;">Omni AI</h1>
    <p style="color:#9ca3af;font-size:14px;margin:0;">Your training seat is confirmed</p>
  </div>

  <div style="background:#1a1a2e;border:1px solid rgba(168,85,247,0.3);border-radius:16px;padding:32px;margin-bottom:24px;">
    <h2 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Hey ${p.name}!</h2>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      You're locked in for the free AI CEO training. Get ready to see how an autonomous AI can run your business while you sleep.
    </p>

    <div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:80px;">Date</td>
          <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${p.dateFormatted}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Time</td>
          <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${p.time} CT</td>
        </tr>
      </table>
    </div>

    <p style="color:#6b7280;font-size:12px;text-align:center;margin:0 0 20px;">
      A calendar invite (.ics) is attached to this email
    </p>
  </div>

  <!-- Free Premium Upgrade Section -->
  <div style="background:#1a1a2e;border:1px solid rgba(245,158,11,0.3);border-radius:16px;padding:32px;margin-bottom:24px;">
    <div style="text-align:center;margin-bottom:16px;">
      <span style="display:inline-block;background:rgba(245,158,11,0.2);color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;padding:4px 14px;border-radius:20px;border:1px solid rgba(245,158,11,0.3);">Free Upgrade</span>
    </div>
    <h3 style="color:#f59e0b;font-size:18px;text-align:center;margin:0 0 12px;">You Just Unlocked Premium Access</h3>
    <p style="color:#d1d5db;font-size:14px;line-height:1.7;text-align:center;margin:0 0 20px;">
      Because you reserved your seat, you now have free access to our premium Interlinked newsletter. No extra steps needed — it's already active on your account.
    </p>

    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#f59e0b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">The Revolution of AI</p>
      <p style="color:#e0e0e0;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Two businesses launched the same year, same market, same funding. One is thriving. The other is scrambling to survive. The difference wasn't talent or luck — it was timing. The ones who moved with AI didn't just adapt. They became untouchable.
      </p>
      <p style="color:#e0e0e0;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Right now, AI isn't replacing jobs — it's replacing entire business models. The companies that understand this aren't just surviving. They're building empires while their competitors are still debating whether to "try ChatGPT."
      </p>
      <p style="color:#e0e0e0;font-size:14px;line-height:1.7;margin:0;">
        The question isn't whether AI will transform your industry. It already has. The only question is whether you'll be the one leading that transformation — or watching it happen from the sideline.
      </p>
    </div>

    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
      Premium insights delivered to your inbox — no action needed.
    </p>
  </div>

  <div style="text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
    <p style="color:#6b7280;font-size:12px;margin:0 0 4px;">
      Omni AI — Autonomous Lead Generation & Business Automation
    </p>
    <a href="https://omnileadsagi.com" style="color:#a855f7;font-size:12px;text-decoration:none;">omnileadsagi.com</a>
  </div>
</div>
</body></html>`;
}

function buildOwnerEmail(p: { name: string; email: string; phone: string; dateFormatted: string; time: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#22c55e;font-size:28px;margin:0;">New Training Registration!</h1>
  </div>

  <div style="background:#1a1a2e;border:1px solid rgba(34,197,94,0.3);border-radius:16px;padding:32px;margin-bottom:24px;">
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Someone just registered for the free AI CEO training:
    </p>

    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:80px;">Name</td>
          <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${p.name}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Email</td>
          <td style="color:#60a5fa;font-size:14px;padding:6px 0;"><a href="mailto:${p.email}" style="color:#60a5fa;text-decoration:none;">${p.email}</a></td>
        </tr>
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Phone</td>
          <td style="color:#d1d5db;font-size:14px;padding:6px 0;"><a href="tel:${p.phone}" style="color:#d1d5db;text-decoration:none;">${p.phone}</a></td>
        </tr>
      </table>
    </div>

    <div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:80px;">Date</td>
          <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${p.dateFormatted}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Time</td>
          <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${p.time} CT</td>
        </tr>
      </table>
    </div>
  </div>

  <div style="text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
    <p style="color:#6b7280;font-size:12px;margin:0;">Omni AI Training System</p>
  </div>
</div>
</body></html>`;
}

/**
 * Email Templates for Demo Booking Automation
 */

interface BookingDetails {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  purpose: string;
  dateFormatted: string; // e.g. "Tuesday, April 1, 2026"
  time: string;          // e.g. "2:00 PM"
  googleCalendarUrl: string;
}

/**
 * Confirmation email sent to the person who booked the demo
 */
export function bookerConfirmationEmail(booking: BookingDetails): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;margin:0 0 8px;">
        <span style="color:#a855f7;">Omni AI</span>
      </h1>
      <p style="color:#9ca3af;font-size:14px;margin:0;">Your demo is confirmed</p>
    </div>

    <!-- Main Card -->
    <div style="background:#1a1a2e;border:1px solid rgba(168,85,247,0.3);border-radius:16px;padding:32px;margin-bottom:24px;">
      <h2 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Hey ${booking.name}!</h2>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Your demo with Omni AI is locked in. We're excited to show you how autonomous AI can transform ${booking.businessName || 'your business'}.
      </p>

      <!-- Meeting Details Box -->
      <div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:80px;">Date</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.dateFormatted}</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Time</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.time} CT</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Purpose</td>
            <td style="color:#d1d5db;font-size:14px;padding:6px 0;">${booking.purpose}</td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${booking.googleCalendarUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
          Add to Google Calendar
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
        A calendar invite (.ics) is also attached to this email
      </p>
    </div>

    <!-- Reminder Note -->
    <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#fbbf24;font-size:13px;font-weight:600;margin:0 0 4px;">Heads up</p>
      <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0;">
        If anything comes up, please let us know at least 24 hours in advance so we can fill the slot. You'll receive a reminder 24 hours and 1 hour before the meeting.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
      <p style="color:#6b7280;font-size:12px;margin:0 0 4px;">
        Omni AI &mdash; Autonomous Lead Generation & Business Automation
      </p>
      <a href="https://omnileadsagi.com" style="color:#a855f7;font-size:12px;text-decoration:none;">omnileadsagi.com</a>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Notification email sent to the owner (sitanim8@gmail.com) when someone books a demo
 */
export function ownerNotificationEmail(booking: BookingDetails): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;margin:0 0 8px;">
        <span style="color:#22c55e;">New Demo Booked!</span>
      </h1>
    </div>

    <!-- Main Card -->
    <div style="background:#1a1a2e;border:1px solid rgba(34,197,94,0.3);border-radius:16px;padding:32px;margin-bottom:24px;">
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Someone just booked a demo on Omni AI. Here are the details:
      </p>

      <!-- Contact Details -->
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:100px;">Name</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.name}</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Email</td>
            <td style="color:#60a5fa;font-size:14px;padding:6px 0;">
              <a href="mailto:${booking.email}" style="color:#60a5fa;text-decoration:none;">${booking.email}</a>
            </td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Phone</td>
            <td style="color:#d1d5db;font-size:14px;padding:6px 0;">
              <a href="tel:${booking.phone}" style="color:#d1d5db;text-decoration:none;">${booking.phone}</a>
            </td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Business</td>
            <td style="color:#d1d5db;font-size:14px;padding:6px 0;">${booking.businessName || 'Not specified'}</td>
          </tr>
        </table>
      </div>

      <!-- Meeting Details -->
      <div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:100px;">Date</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.dateFormatted}</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Time</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.time} CT</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Purpose</td>
            <td style="color:#d1d5db;font-size:14px;padding:6px 0;">${booking.purpose}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${booking.googleCalendarUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#2563eb);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
          Add to Google Calendar
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
      <p style="color:#6b7280;font-size:12px;margin:0;">
        Omni AI Demo Booking System &mdash; <a href="https://omnileadsagi.com" style="color:#a855f7;text-decoration:none;">Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * 24-hour reminder email sent to the booker
 */
export function reminderEmail(booking: BookingDetails): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px;">
        <span style="color:#a855f7;">Omni AI</span>
      </h1>
    </div>

    <div style="background:#1a1a2e;border:1px solid rgba(251,191,36,0.3);border-radius:16px;padding:32px;margin-bottom:24px;">
      <h2 style="color:#fbbf24;font-size:20px;margin:0 0 12px;">Reminder: Your Demo is Tomorrow</h2>
      <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hey ${booking.name}, just a friendly reminder that your Omni AI demo is coming up!
      </p>

      <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;width:80px;">Date</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.dateFormatted}</td>
          </tr>
          <tr>
            <td style="color:#9ca3af;font-size:13px;padding:6px 0;">Time</td>
            <td style="color:#ffffff;font-size:15px;font-weight:600;padding:6px 0;">${booking.time} CT</td>
          </tr>
        </table>
      </div>

      <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0;">
        If you need to reschedule, please let us know as soon as possible. See you there!
      </p>
    </div>

    <div style="text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
      <a href="https://omnileadsagi.com" style="color:#a855f7;font-size:12px;text-decoration:none;">omnileadsagi.com</a>
    </div>
  </div>
</body>
</html>`.trim();
}

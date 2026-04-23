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
      <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">You're all set, ${booking.name}.</h1>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0;">
        Your demo is locked in. We're excited to show you how autonomous AI can transform ${booking.businessName || 'your business'}.
      </p>
    </div>

    <!-- Meeting Card -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Your Meeting</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Date</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.dateFormatted}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Time</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.time} CT</td>
        </tr>
        ${booking.purpose ? `<tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Purpose</td>
          <td style="color:#d1d5db;font-size:14px;padding:8px 0;">${booking.purpose}</td>
        </tr>` : ''}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0 12px;">
      <a href="${booking.googleCalendarUrl}" target="_blank" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:600;">
        Add to Google Calendar
      </a>
    </div>
    <p style="color:#4b5563;font-size:12px;text-align:center;margin:0 0 28px;">
      A calendar invite (.ics) is also attached to this email.
    </p>

    <!-- Reminder Note -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #f59e0b;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
      <p style="color:#f59e0b;font-size:12px;font-weight:600;margin:0 0 4px;">Heads up</p>
      <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0;">
        If anything comes up, let us know at least 24 hours in advance so we can fill the slot.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
      <p style="color:#4b5563;font-size:11px;margin:0;">
        Omni AI &middot; Autonomous Intelligence &middot; <a href="https://omnileadsagi.com" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Notification email sent to the owner (alfred@omnileadsagi.com) when someone books a demo
 */
export function ownerNotificationEmail(booking: BookingDetails): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Top Bar -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
        <td align="right" style="color:#22c55e;font-size:12px;font-weight:600;letter-spacing:1px;">NEW BOOKING</td>
      </tr>
    </table>

    <!-- Header -->
    <div style="margin-bottom:28px;">
      <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">New Demo Booked</h1>
      <p style="color:#6b7280;font-size:13px;margin:0;">A new lead just scheduled a demo on your platform.</p>
    </div>

    <!-- Contact Card -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Contact</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;width:90px;vertical-align:top;">Name</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.name}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Email</td>
          <td style="padding:8px 0;"><a href="mailto:${booking.email}" style="color:#60a5fa;font-size:14px;text-decoration:none;">${booking.email}</a></td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Phone</td>
          <td style="padding:8px 0;"><a href="tel:${booking.phone}" style="color:#d1d5db;font-size:14px;text-decoration:none;">${booking.phone}</a></td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Business</td>
          <td style="color:#d1d5db;font-size:14px;padding:8px 0;">${booking.businessName || 'Not specified'}</td>
        </tr>
      </table>
    </div>

    <!-- Meeting Card -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Meeting Details</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;width:90px;vertical-align:top;">Date</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.dateFormatted}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Time</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.time} CT</td>
        </tr>
        ${booking.purpose ? `<tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Purpose</td>
          <td style="color:#d1d5db;font-size:14px;padding:8px 0;">${booking.purpose}</td>
        </tr>` : ''}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${booking.googleCalendarUrl}" target="_blank" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:600;">
        Add to Calendar
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
      <p style="color:#4b5563;font-size:11px;margin:0;">
        Omni AI &middot; <a href="https://omnileadsagi.com" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
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
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Top Bar -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td style="color:#a855f7;font-size:14px;font-weight:700;letter-spacing:0.5px;">OMNI AI</td>
        <td align="right" style="color:#f59e0b;font-size:12px;font-weight:600;letter-spacing:1px;">REMINDER</td>
      </tr>
    </table>

    <!-- Content -->
    <div style="margin-bottom:28px;">
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;">Your demo is tomorrow</h1>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0;">
        Hey ${booking.name}, just a reminder that your Omni AI demo is coming up.
      </p>
    </div>

    <!-- Meeting Card -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;width:80px;vertical-align:top;">Date</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.dateFormatted}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;vertical-align:top;">Time</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:8px 0;">${booking.time} CT</td>
        </tr>
      </table>
    </div>

    <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 28px;">
      If you need to reschedule, please let us know as soon as possible. See you there.
    </p>

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #222222;">
      <p style="color:#4b5563;font-size:11px;margin:0;">
        Omni AI &middot; <a href="https://omnileadsagi.com" style="color:#6b7280;text-decoration:none;">omnileadsagi.com</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

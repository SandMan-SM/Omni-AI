/**
 * Calendar Utilities — .ics generation for email invites
 */

interface CalendarEvent {
  summary: string;
  description: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  uid?: string;
}

/**
 * Format a Date to iCalendar DTSTART/DTEND format (UTC)
 */
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate a .ics calendar invite string
 * Uses METHOD:REQUEST so Gmail/Outlook auto-show as calendar invite
 */
export function generateICS(event: CalendarEvent): string {
  const uid = event.uid || `${Date.now()}-${Math.random().toString(36).slice(2)}@omnileadsagi.com`;
  const now = formatICSDate(new Date());
  const start = formatICSDate(event.startDate);
  const end = formatICSDate(event.endDate);

  // Escape special characters in text fields
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Omni AI//Demo Booking//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(event.summary)}`,
    `DESCRIPTION:${escape(event.description)}`,
    event.location ? `LOCATION:${escape(event.location)}` : '',
    `ORGANIZER;CN=${escape(event.organizerName)}:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${escape(event.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:${event.attendeeEmail}`,
    `ATTENDEE;CN=${escape(event.organizerName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${event.organizerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // 24-hour reminder popup
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Omni AI Demo in 24 hours',
    'END:VALARM',
    // 1-hour reminder popup
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Omni AI Demo in 1 hour',
    'END:VALARM',
    // 15-minute reminder popup
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Omni AI Demo starting in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/**
 * Parse a date string (YYYY-MM-DD) and time string (e.g. "2:00 PM") into a Date object
 * Assumes America/Chicago timezone
 */
export function parseBookingDateTime(dateStr: string, timeStr: string): Date {
  const [timePart, ampm] = timeStr.split(' ');
  const [hrs, mins] = timePart.split(':').map(Number);
  let hour24 = hrs;
  if (ampm === 'PM' && hrs !== 12) hour24 += 12;
  if (ampm === 'AM' && hrs === 12) hour24 = 0;

  // Parse date parts
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create in Chicago timezone (CST = UTC-6, CDT = UTC-5)
  // Use a simple approach: create the date and adjust for Central Time
  const date = new Date(Date.UTC(year, month - 1, day, hour24 + 5, mins || 0)); // CDT offset (+5 to convert to UTC)

  return date;
}

/**
 * Build a Google Calendar URL for the booker to manually add
 */
export function buildGoogleCalendarUrl(params: {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const urlParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${fmt(params.startDate)}/${fmt(params.endDate)}`,
    details: params.description,
    ctz: 'America/Chicago',
  });

  return `https://calendar.google.com/calendar/render?${urlParams.toString()}`;
}

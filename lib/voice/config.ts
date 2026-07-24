// Shared config for the inbound voice receptionist (ElevenLabs Conversational AI).

// Omni AI's own workspace in omni_businesses (slug 'omnileads'). Bookings,
// leads, and the inbound_omnileads_bookings analytics mirror all key off this.
// Hardcoded (not resolved per-call) so the voice tool routes stay low-latency —
// every extra DB round-trip is audible as dead air on a live call.
export const OMNI_BUSINESS_ID = "146f6f87-6ed7-4c21-a0e3-fac2c91c2748";

// Absolute base URL for server-to-server calls into this same app's public
// routes (availability + booking). Vercel functions can't use relative URLs.
export function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://omnileadsagi.com"
  );
}

// Split a spoken full name into first/last for the CRM lead row.
export function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length === 0 || parts[0] === "") {
    return { first_name: "Caller", last_name: "" };
  }
  const first_name = parts.shift() as string;
  return { first_name, last_name: parts.join(" ") };
}

// Human, PT-formatted label for a slot ISO string — what the agent speaks and
// what confirmation SMS/email show. Server runs UTC; force America/Los_Angeles.
export function humanPacific(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

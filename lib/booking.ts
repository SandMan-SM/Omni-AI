// Centralized booking URL used by every operator-facing CTA on
// proposal / asset pages. Single source of truth so swapping the
// scheduler (Cal.com → Google Appointment Scheduling, etc.) is a
// one-line edit instead of a grep-and-replace across pages.
//
// Currently points at $Mafi's Google Calendar Appointment Scheduling
// page. If you change schedulers, update only this constant.
export const BOOKING_URL =
  "https://calendar.app.google/sitanim";

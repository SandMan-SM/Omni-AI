/**
 * Pacific-Time helpers.
 *
 * The dashboard's "today" / "this week" semantics are operator-facing, and
 * the operator works in PT. Vercel runs in UTC, so naive `setHours(0)` /
 * `toISOString().slice(0,10)+"T00:00:00Z"` patterns yield UTC midnight,
 * which is 4-5 PM PT *yesterday*. Mid-morning PT viewing then mixed
 * yesterday's late-afternoon items into "today" and dropped early-morning-PT
 * ones from before 5 AM PT.
 *
 * These helpers anchor "today" on the PT calendar day and convert PT
 * wall-clock moments to UTC ISO for supabase/PostgREST date filters,
 * handling PDT ↔ PST transitions automatically via Intl.
 */

const PT_TZ = 'America/Los_Angeles';

const ptDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PT_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
});

const ptHourMinuteFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PT_TZ,
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** Today's calendar date in PT, formatted YYYY-MM-DD. */
export function todayPt(now: Date = new Date()): string {
  return ptDateFormatter.format(now);
}

/** Tuple of [year, month-1, day] for the given (or current) PT calendar day. */
export function todayPtParts(now: Date = new Date()): [number, number, number] {
  const [y, m, d] = todayPt(now).split('-').map(n => parseInt(n, 10));
  return [y, m - 1, d];
}

/**
 * Build a UTC Date that represents the given wall-clock moment in PT.
 * Handles DST transitions — the offset is detected per-call from Intl.
 *
 * Example: ptWallToUtc(2026, 4, 6, 9, 0) (May 6 = PDT)  → 2026-05-06T16:00Z
 *          ptWallToUtc(2026, 0, 6, 9, 0) (Jan 6 = PST)  → 2026-01-06T17:00Z
 */
export function ptWallToUtc(
  year: number,
  month0: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  ms = 0,
): Date {
  const utcGuess = new Date(Date.UTC(year, month0, day, hour, minute, second, ms));
  const parts = ptHourMinuteFormatter.formatToParts(utcGuess);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
  const ptHour = get('hour') === 24 ? 0 : get('hour');
  const offsetMin = (hour - ptHour) * 60 + (minute - get('minute'));
  return new Date(utcGuess.getTime() + offsetMin * 60_000);
}

/** ISO string for 00:00:00.000 PT on the given (or current) PT calendar day. */
export function ptStartOfDayIso(now: Date = new Date()): string {
  const [y, m0, d] = todayPtParts(now);
  return ptWallToUtc(y, m0, d, 0, 0, 0, 0).toISOString();
}

/** ISO string for 23:59:59.999 PT on the given (or current) PT calendar day. */
export function ptEndOfDayIso(now: Date = new Date()): string {
  const [y, m0, d] = todayPtParts(now);
  return ptWallToUtc(y, m0, d, 23, 59, 59, 999).toISOString();
}

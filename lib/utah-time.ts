// Utah-time helpers + viewer-local auto-adjust.
//
// Source of truth: America/Denver (Mountain Time, observes DST).
// All DB timestamps are stored as timestamptz (UTC internally) but the
// "business clock" is Utah's. Owner-facing places (cron schedules, ICS
// sender, internal logs) reference Utah time. Visitor-facing renders
// (lead detail panels, meeting cards, dashboards) auto-adjust to the
// viewer's local timezone via Intl.

export const UTAH_TZ = "America/Denver";

/** Get the viewer's IANA timezone, falling back to Utah for SSR / older browsers. */
export function viewerTimeZone(): string {
  try {
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    }
  } catch { /* fall through */ }
  return UTAH_TZ;
}

interface FormatOptions {
  /** Force a specific tz — defaults to viewer's local. Pass UTAH_TZ when displaying owner-side text like cron schedules. */
  tz?: string;
  /** Include date (default true) */
  showDate?: boolean;
  /** Include time (default true) */
  showTime?: boolean;
  /** Include weekday (default false) */
  showWeekday?: boolean;
  /** Include year (default depends on relative age — past year always shown) */
  showYear?: boolean;
  /** Include trailing tz suffix like ' MST' (default false) */
  showTzSuffix?: boolean;
}

/** Format an ISO timestamp / Date for display. Auto-adjusts to viewer's timezone unless `tz` is set. */
export function formatTime(
  input: string | number | Date | null | undefined,
  opts: FormatOptions = {},
): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "—";

  const tz = opts.tz ?? viewerTimeZone();
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const showYear = opts.showYear ?? !sameYear;

  const fmt: Intl.DateTimeFormatOptions = { timeZone: tz };
  if (opts.showDate !== false) {
    if (opts.showWeekday) fmt.weekday = "short";
    fmt.month = "short";
    fmt.day = "numeric";
    if (showYear) fmt.year = "numeric";
  }
  if (opts.showTime !== false) {
    fmt.hour = "numeric";
    fmt.minute = "2-digit";
    if (opts.showTzSuffix) fmt.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat("en-US", fmt).format(d);
}

/** Convenience: format a timestamp specifically in Utah time (with MT suffix). */
export function formatUtah(input: string | number | Date | null | undefined, opts: Omit<FormatOptions, "tz"> = {}): string {
  return formatTime(input, { ...opts, tz: UTAH_TZ, showTzSuffix: opts.showTzSuffix ?? true });
}

/** Relative time ("2h ago", "3 days ago"). Locale-friendly. */
export function relativeTime(input: string | number | Date | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor(abs / 3_600_000);
  const mins  = Math.floor(abs / 60_000);
  const future = diff < 0;
  let label: string;
  if (days >= 365) label = `${Math.floor(days / 365)}y`;
  else if (days >= 30) label = `${Math.floor(days / 30)}mo`;
  else if (days >= 7)  label = `${Math.floor(days / 7)}w`;
  else if (days >= 1)  label = `${days}d`;
  else if (hours >= 1) label = `${hours}h`;
  else if (mins >= 1)  label = `${mins}m`;
  else                 label = "just now";
  if (label === "just now") return label;
  return future ? `in ${label}` : `${label} ago`;
}

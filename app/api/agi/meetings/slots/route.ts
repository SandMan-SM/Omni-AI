import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Returns available time slots for a business.
// If no slots are configured, generates a default schedule:
// next 14 weekdays, 9-11am and 2-4pm Pacific, in 15-min increments,
// skipping any times already booked.
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  // Pull existing bookings for next 14 days
  const fortnightFromNow = new Date(Date.now() + 14 * 86400000).toISOString();
  const { data: booked } = await supabase
    .from('omni_meeting_bookings')
    .select('start_at, duration_minutes')
    .eq('business_id', business_id)
    .eq('status', 'confirmed')
    .lte('start_at', fortnightFromNow);

  const bookedTimes = new Set((booked ?? []).map(b => b.start_at));

  // Generate default slots (next 14 weekdays, 9-11am + 2-4pm PT in 15-min increments).
  // PT-aware: build the wall-clock moment in America/Los_Angeles and convert
  // to a UTC ISO string. Vercel runs in UTC, so the previous code was using
  // setHours(h) in UTC and serving "9 AM" slots that the booking widget then
  // rendered as 2 AM in the user's local PT timezone. Intl-based detection
  // handles PDT/PST correctly across the spring/fall DST transitions.
  const slots: { start_at: string; available: boolean }[] = [];

  function ptWallToUtcIso(year: number, month0: number, day: number, ptHour: number, ptMinute: number): string {
    // Start with a UTC guess that has the requested hour/minute in UTC.
    // Compare its rendering in PT to the requested PT hour/minute and
    // shift by the delta — gives us the actual UTC moment whose PT
    // wall-clock is exactly H:M, regardless of DST.
    const utcGuess = new Date(Date.UTC(year, month0, day, ptHour, ptMinute));
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(utcGuess);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value, 10);
    const ptHourActual = get('hour') === 24 ? 0 : get('hour');
    const offsetMin = (ptHour - ptHourActual) * 60 + (ptMinute - get('minute'));
    return new Date(utcGuess.getTime() + offsetMin * 60_000).toISOString();
  }

  // Use today's PT calendar date as the base so we don't accidentally roll
  // a UTC-anchored "tomorrow" into the wrong PT day near midnight UTC.
  const now = new Date();
  const todayPt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now); // YYYY-MM-DD in PT
  const [py, pm, pd] = todayPt.split('-').map(n => parseInt(n, 10));
  const todayPtAsUtc = new Date(Date.UTC(py, pm - 1, pd));

  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const day = new Date(todayPtAsUtc);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends in PT

    for (const [startHour, endHour] of [[9, 11], [14, 16]]) {
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          const iso = ptWallToUtcIso(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            h,
            m,
          );
          slots.push({ start_at: iso, available: !bookedTimes.has(iso) });
        }
      }
    }
  }

  return NextResponse.json({ slots });
}

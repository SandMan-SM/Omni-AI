import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { todayPtParts, ptWallToUtc } from '@/lib/tz';
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

  // Generate default slots (next 14 weekdays, 9-11am + 2-4pm PT in 15-min
  // increments). PT-aware via lib/tz so the booking widget's "9 AM" actually
  // renders as 9 AM PT in the visitor's browser, not 2 AM PT.
  const slots: { start_at: string; available: boolean }[] = [];
  const [py, pm0, pd] = todayPtParts();
  const todayPtAsUtc = new Date(Date.UTC(py, pm0, pd));

  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const day = new Date(todayPtAsUtc);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends in PT

    for (const [startHour, endHour] of [[9, 11], [14, 16]]) {
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          const iso = ptWallToUtc(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            h,
            m,
          ).toISOString();
          slots.push({ start_at: iso, available: !bookedTimes.has(iso) });
        }
      }
    }
  }

  return NextResponse.json({ slots });
}

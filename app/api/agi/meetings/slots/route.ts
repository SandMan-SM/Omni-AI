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

  // Generate default slots (next 14 weekdays, 9-11am + 2-4pm PT in 15-min increments)
  const slots: { start_at: string; available: boolean }[] = [];
  const now = new Date();

  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    // 9-11am and 2-4pm PT
    for (const [startHour, endHour] of [[9, 11], [14, 16]]) {
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          const slot = new Date(day);
          slot.setHours(h, m, 0, 0);
          const iso = slot.toISOString();
          slots.push({ start_at: iso, available: !bookedTimes.has(iso) });
        }
      }
    }
  }

  return NextResponse.json({ slots });
}

import { createAdminClient } from '@/lib/supabase/admin';
import { todayPtParts, ptWallToUtc } from '@/lib/tz';

export type MeetingSlot = { start_at: string; available: boolean };

/**
 * Default availability for a business: the next 14 weekdays, 9–11am and
 * 2–4pm Pacific, in 15-minute increments, minus anything already booked.
 *
 * This lives in `lib/` rather than in the route handler so the public
 * booking page and `/api/agi/meetings/slots` cannot drift apart — two
 * copies of a schedule is how a widget ends up offering a time the
 * dashboard has already confirmed for somebody else.
 *
 * The booked-times read uses the **service role**, not the anon key.
 * `omni_meeting_bookings` is RLS-locked to `service_role`, so the anon
 * client silently returned an empty list and every slot looked available:
 * the one check the endpoint exists to perform was never running.
 *
 * PT-aware via `lib/tz`, so "9 AM" means 9 AM Pacific rather than
 * 2 AM Pacific in the visitor's browser.
 */
export async function generateMeetingSlots(businessId: string): Promise<MeetingSlot[]> {
  const fortnightFromNow = new Date(Date.now() + 14 * 86400000).toISOString();

  const { data: booked, error } = await createAdminClient()
    .from('omni_meeting_bookings')
    .select('start_at, duration_minutes')
    .eq('business_id', businessId)
    .eq('status', 'confirmed')
    .lte('start_at', fortnightFromNow);

  if (error) {
    console.error('[meeting-slots] booked-times query failed:', error);
  }

  // Compare by instant, never by string. `start_at` is a `timestamptz`
  // and PostgREST renders it in the database session timezone
  // ("2026-04-27T10:15:00-06:00") while the generated slots are UTC
  // ("2026-04-27T16:15:00.000Z"). The two describe the same moment but
  // are different strings, so a string set lookup missed every booking
  // and the widget happily offered times that were already confirmed.
  const bookedTimes = new Set(
    (booked ?? []).map(b => new Date(b.start_at as string).getTime()),
  );

  const slots: MeetingSlot[] = [];
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
          slots.push({ start_at: iso, available: !bookedTimes.has(new Date(iso).getTime()) });
        }
      }
    }
  }

  return slots;
}

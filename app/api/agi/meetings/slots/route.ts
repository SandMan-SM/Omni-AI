import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { generateMeetingSlots } from '@/lib/agi/meeting-slots';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Returns available time slots for a business.
// The schedule itself lives in `lib/agi/meeting-slots.ts` so this route
// and the public booking page always offer the same times.
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const slots = await generateMeetingSlots(business_id);
  return NextResponse.json({ slots });
}

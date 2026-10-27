import { generateMeetingSlots } from '@/lib/agi/meeting-slots';
import BookingClient, { type BookingBusiness } from './BookingClient';

/**
 * Computes the availability schedule for a business.
 *
 * It lives behind the page's internal `<Suspense>` so the skeleton can
 * stream while the schedule is generated, without putting a
 * `loading.tsx` above the route (which would commit the HTTP status
 * before the page's `notFound()` could run).
 */
export default async function BookingSlots({
  business,
}: {
  business: BookingBusiness;
}) {
  const slots = await generateMeetingSlots(business.id);
  return <BookingClient business={business} slots={slots} />;
}

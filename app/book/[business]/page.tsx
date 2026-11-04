import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupContent, requireLookup } from '@/lib/server/content-lookup';
import PageLoading from '@/components/page-loading';
import BookingSlots from './BookingSlots';

// The booking link is shared by email, so an id that no longer exists
// must answer a real 404 rather than a rendered "not found" page served
// with a 200. That means this route resolves the business on the server
// and calls `notFound()` — and, per the `loading.tsx` rule, there is no
// `loading.tsx` anywhere above this segment (the previous one has been
// removed). Skeleton coverage now comes from the internal `<Suspense>`
// boundary below, which sits *after* the 404 check, so a dead link never
// flushes a fallback that would commit a 200.
export const dynamic = 'force-dynamic';

export default async function BookingPage({
  params,
}: {
  params: { business: string };
}) {
  const { business: bizId } = params;

  // Service role, not the anon key: `omni_businesses` is RLS-locked to
  // `service_role`, so an anon read returns an empty list for every id
  // and the page could never tell a real business from a dead link.
  //
  // A FAILED read is not a dead link. This used to log the error and call
  // `notFound()` anyway, so a database blip answered HTTP 404 for a
  // business that exists — telling a crawler the booking page was never
  // published, and telling a customer who followed a link from an email
  // that the business does not accept bookings. A failed lookup now
  // throws (a 500, which says "try again"); only a read that succeeded
  // and found no row produces the 404.
  const business = requireLookup(
    await lookupContent(() =>
      createAdminClient()
        .from('omni_businesses')
        .select('id, name, industry, sender_name')
        .eq('id', bizId)
        .maybeSingle(),
    ),
  );

  if (!business) {
    notFound();
  }

  return (
    <Suspense fallback={<PageLoading label="Loading availability…" />}>
      <BookingSlots business={business} />
    </Suspense>
  );
}
